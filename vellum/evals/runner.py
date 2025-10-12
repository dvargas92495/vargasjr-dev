#!/usr/bin/env python3

import re
import sys
import time
import asyncio
import importlib
from pathlib import Path
import inspect
from typing import Dict, Any, List
from workflows.triage_message.workflow import TriageMessageWorkflow
from evals.base import BaseEval


class EvalRunner:
    """
    Runner for executing evaluation test cases locally and measuring outcomes with 0-1 scoring.
    """
    
    def __init__(self):
        self.workflow = TriageMessageWorkflow()
    
    def run_eval(self, eval_name: str) -> Dict[str, Any]:
        """
        Run a specific evaluation by name and return results with 0-1 score.
        
        Args:
            eval_name: Name of the eval to run (e.g., 'who_are_you_text_message')
        
        Returns:
            Dict containing eval results and score
        """
        try:
            eval_module = importlib.import_module(f"evals.{eval_name}.test_case")
            eval_class = self._get_eval_class(eval_module)
            
            eval_instance = eval_class()
            
            results = asyncio.run(self._execute_eval(eval_instance))
            
            score = self._calculate_score(results)
            
            return {
                "eval_name": eval_instance.name,
                "score": score,
                "results": results,
                "test_data_summary": self._summarize_test_cases(eval_instance.test_cases)
            }
            
        except Exception as e:
            return {
                "eval_name": eval_name,
                "score": 0.0,
                "error": str(e),
                "results": None
            }
    
    def _get_eval_class(self, eval_module) -> type:
        """Find and return the BaseEval subclass from the eval module"""
        for name, obj in inspect.getmembers(eval_module):
            if (inspect.isclass(obj) and 
                issubclass(obj, BaseEval) and 
                obj is not BaseEval):
                return obj
        raise ValueError(f"No BaseEval subclass found in module {eval_module}")
    
    def _evaluate_metric(self, metric: Dict[str, Any], outputs: Dict[str, Any]) -> bool:
        """
        Evaluate a single metric against workflow outputs.
        
        Args:
            metric: Metric definition with type, output_name, expected_value/target_expression, weight
            outputs: Dictionary of workflow outputs
        
        Returns:
            True if metric is satisfied, False otherwise
        """
        metric_type = metric.get('type')
        output_name = metric.get('output_name')
        
        if output_name not in outputs:
            return False
        
        actual_value = outputs[output_name]
        
        if metric_type == 'exact_match':
            expected_value = metric.get('expected_value')
            return actual_value == expected_value
        elif metric_type == 'regex_match':
            target_expression = metric.get('target_expression')
            if not isinstance(actual_value, str):
                return False
            if not isinstance(target_expression, str):
                return False
            try:
                return bool(re.search(target_expression, actual_value))
            except re.error:
                return False
        
        return False
    
    async def _execute_eval(self, eval_instance: BaseEval) -> List[Dict[str, Any]]:
        """Execute the evaluation test cases"""
        results = []
        
        for test_case in eval_instance.test_cases:
            test_case_id = test_case.get('id', 'Unknown')
            try:
                start_time = time.time()
                workflow_result = self.workflow.run()
                latency = time.time() - start_time
                
                success = workflow_result.name == "workflow.execution.fulfilled"
                
                result = {
                    "test_case": test_case_id,
                    "success": success,
                    "latency": latency
                }
                
                if success:
                    outputs = {k: v for k, v in workflow_result.outputs}
                    result["workflow_result"] = outputs
                    
                    metrics = test_case.get('metrics', [])
                    if metrics:
                        total_weight = sum(m.get('weight', 0) for m in metrics)
                        actual_score = sum(
                            m.get('weight', 0) 
                            for m in metrics 
                            if self._evaluate_metric(m, outputs)
                        )
                        score = round(actual_score / total_weight, 2) if total_weight > 0 else 0.0
                    else:
                        score = 1.0
                    
                    result["score"] = score
                else:
                    result["workflow_result"] = {"error": workflow_result.error.model_dump()}
                    result["score"] = 0.0
                
                if 'expected_trigger' in test_case:
                    result["expected_trigger"] = test_case['expected_trigger']
                
                results.append(result)
                
            except Exception as e:
                results.append({
                    "test_case": test_case_id,
                    "success": False,
                    "error": str(e),
                    "latency": 0.0,
                    "score": 0.0
                })
        
        return results
    
    def _calculate_score(self, results: List[Dict[str, Any]]) -> float:
        """Calculate average score across all test cases"""
        if not results:
            return 0.0
        
        total_score = sum(result.get('score', 0.0) for result in results)
        
        return round(total_score / len(results), 2) if results else 0.0
    
    def _summarize_test_cases(self, test_cases: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Create summary of test cases for reporting"""
        return {
            "total_test_cases": len(test_cases),
            "test_case_types": list(set(tc.get('type', 'unknown') for tc in test_cases))
        }


def main():
    """Main function for running evals from command line"""
    runner = EvalRunner()
    
    if len(sys.argv) == 1:
        evals_dir = Path(__file__).parent
        all_evals = [
            d.name for d in evals_dir.iterdir()
            if d.is_dir() and not d.name.startswith('_') and (d / 'test_case.py').exists()
        ]
        all_evals.sort()
        
        print("Running all evaluations")
        print("=" * 50)
        
        all_results = []
        total_score = 0.0
        
        for eval_name in all_evals:
            print(f"\nRunning evaluation: {eval_name}")
            print("-" * 50)
            
            result = runner.run_eval(eval_name)
            all_results.append(result)
            
            print(f"Eval: {result['eval_name']}")
            print(f"Score: {result['score']:.2f}")
            
            if result.get('error'):
                print(f"Error: {result['error']}")
            else:
                print(f"Test Results: {len(result['results'])} test cases")
                for i, test_result in enumerate(result['results'], 1):
                    status = "✅ PASS" if test_result.get('success') else "❌ FAIL"
                    latency = test_result.get('latency', 0.0)
                    print(f"  {i}. {test_result.get('test_case', 'Unknown')}: {status} ({latency:.2f}s)")
            
            total_score += result['score']
        
        print("\n" + "=" * 50)
        print(f"OVERALL RESULTS: {len(all_evals)} evaluations")
        print(f"Average Score: {total_score / len(all_evals):.2f}")
        print("=" * 50)
        
        failed_evals = []
        for result in all_results:
            if result.get('error') or result['score'] < 0.5:
                failed_evals.append(result['eval_name'])
        
        if failed_evals:
            print(f"\n❌ FAILED: {len(failed_evals)} eval(s) failed or scored below 0.5:")
            for eval_name in failed_evals:
                print(f"  - {eval_name}")
            sys.exit(1)
        
    elif len(sys.argv) == 2:
        eval_name = sys.argv[1]
        
        print(f"Running evaluation: {eval_name}")
        print("=" * 50)
        
        result = runner.run_eval(eval_name)
        
        print(f"Eval: {result['eval_name']}")
        print(f"Score: {result['score']:.2f}")
        
        if result.get('error'):
            print(f"Error: {result['error']}")
        else:
            print(f"Test Results: {len(result['results'])} test cases")
            for i, test_result in enumerate(result['results'], 1):
                status = "✅ PASS" if test_result.get('success') else "❌ FAIL"
                latency = test_result.get('latency', 0.0)
                print(f"  {i}. {test_result.get('test_case', 'Unknown')}: {status} ({latency:.2f}s)")
        
        print("=" * 50)
        
        if result.get('error'):
            print(f"\n❌ FAILED: Eval encountered an error")
            sys.exit(1)
        
        if result['score'] < 0.5:
            print(f"\n❌ FAILED: Score {result['score']:.2f} is below threshold of 0.5")
            sys.exit(1)
        
    else:
        print("Usage: python runner.py [eval_name]")
        print("Examples:")
        print("  python runner.py                          # Run all evals")
        print("  python runner.py who_are_you_text_message # Run specific eval")
        sys.exit(1)


if __name__ == "__main__":
    main()
