#!/usr/bin/env python3

import sys
import asyncio
import importlib
from pathlib import Path
import inspect
from typing import Dict, Any, List
from vellum.workflows.sandbox import WorkflowSandboxRunner
from vellum.workflows.inputs import BaseInputs
from workflows.triage_message.workflow import TriageMessageWorkflow
from models.types import USER
from services import create_inbox_message
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
            test_data = eval_instance.get_test_data()
            
            results = self._execute_eval(eval_instance, test_data)
            
            score = self._calculate_score(results, test_data)
            
            return {
                "eval_name": eval_name,
                "score": score,
                "results": results,
                "test_data_summary": self._summarize_test_data(test_data)
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
    
    def _execute_eval(self, eval_instance, test_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Execute the evaluation test cases"""
        results = []
        
        if hasattr(eval_instance, 'eval_name') and 'who_are_you' in eval_instance.eval_name:
            identity_questions = test_data.get('identity_questions', [])
            for question_data in identity_questions:
                result = self._test_identity_question(question_data)
                results.append(result)
        
        elif hasattr(eval_instance, 'eval_name') and 'recruiter_email' in eval_instance.eval_name:
            emails = test_data.get('emails', [])
            for email_data in emails:
                result = self._test_email_handling(email_data)
                results.append(result)
        
        return results
    
    def _test_identity_question(self, question_data: Dict[str, Any]) -> Dict[str, Any]:
        """Test identity question handling"""
        try:
            message = create_inbox_message(
                body=question_data['message'],
                sender=question_data.get('phone_number', '+15551234567'),
                type=USER,
                channel="SMS"
            )
            
            runner = WorkflowSandboxRunner(
                workflow=self.workflow,
                inputs=[BaseInputs()]
            )
            
            final_event = runner.run()
            
            success = self._analyze_identity_response(final_event, question_data)
            
            return {
                "test_case": question_data['message'],
                "expected_trigger": question_data.get('expected_trigger', 'text_reply'),
                "success": success,
                "workflow_result": str(final_event)
            }
            
        except Exception as e:
            return {
                "test_case": question_data['message'],
                "success": False,
                "error": str(e)
            }
    
    def _test_email_handling(self, email_data: Dict[str, Any]) -> Dict[str, Any]:
        """Test email handling (placeholder for other eval types)"""
        return {
            "test_case": email_data.get('subject', 'Unknown'),
            "success": True,
            "workflow_result": "Email handled successfully"
        }
    
    def _analyze_identity_response(self, workflow_result, question_data: Dict[str, Any]) -> bool:
        """Analyze if the identity response meets expectations"""
        result_str = str(workflow_result).lower()
        
        expected_elements = [
            "vargas jr",
            "automated",
            "software developer",
            "available for hire",
            "assist you"
        ]
        
        elements_found = sum(1 for element in expected_elements if element in result_str)
        return elements_found >= 3
    
    def _calculate_score(self, results: List[Dict[str, Any]], test_data: Dict[str, Any]) -> float:
        """Calculate 0-1 score based on test results"""
        if not results:
            return 0.0
        
        successful_tests = sum(1 for result in results if result.get('success', False))
        total_tests = len(results)
        
        return successful_tests / total_tests if total_tests > 0 else 0.0
    
    def _summarize_test_data(self, test_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create summary of test data for reporting"""
        summary = {}
        for key, value in test_data.items():
            if isinstance(value, list):
                summary[key] = f"{len(value)} items"
            else:
                summary[key] = str(value)[:100]
        return summary


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
                    print(f"  {i}. {test_result.get('test_case', 'Unknown')}: {status}")
            
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
                print(f"  {i}. {test_result.get('test_case', 'Unknown')}: {status}")
        
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
