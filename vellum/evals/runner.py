#!/usr/bin/env python3

import re
import sys
import time
import asyncio
import importlib
from pathlib import Path
import inspect
from typing import Dict, Any, Union, Optional
from uuid import UUID
from workflows.triage_message.workflow import TriageMessageWorkflow
from evals.base import BaseEval
from evals.metrics import BaseMetric, ExactMatchMetric, RegexMatchMetric
from services import postgres_session
from sqlmodel import select
from models.inbox import Inbox
from models.contact import Contact
from models.inbox_message import InboxMessage
from models.types import InboxType


class EvalRunner:
    """
    Runner for executing evaluation test cases locally and measuring outcomes with 0-1 scoring.
    """
    
    def __init__(self):
        self.workflow = TriageMessageWorkflow()
        self._cleanup_records: list[tuple[str, UUID]] = []
    
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
            
            result = asyncio.run(self._execute_eval(eval_instance))
            
            return {
                "eval_name": eval_instance.name,
                "score": result["score"],
                "results": [result],
                "test_case_id": eval_instance.id
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
    
    def _execute_setup_steps(self, eval_instance: BaseEval) -> None:
        """Execute declarative setup steps to prepare database for the eval"""
        if not hasattr(eval_instance, 'get_setup_steps'):
            return
        
        setup_steps = eval_instance.get_setup_steps()
        with postgres_session() as session:
            for step in setup_steps:
                action = step.get("action")
                params = step.get("params", {})
                
                if action == "create_inbox":
                    inbox_name = params["name"]
                    inbox_type = InboxType(params["type"])
                    display_label = params.get("display_label", inbox_name)
                    
                    existing = session.exec(select(Inbox).where(Inbox.name == inbox_name)).first()
                    if not existing:
                        inbox = Inbox(
                            name=inbox_name,
                            type=inbox_type,
                            display_label=display_label,
                            config={}
                        )
                        session.add(inbox)
                        session.commit()
                        session.refresh(inbox)
                        self._cleanup_records.append(("inbox", inbox.id))
                
                elif action == "create_contact":
                    phone_number = params.get("phone_number")
                    email = params.get("email")
                    full_name = params.get("full_name")
                    
                    existing = None
                    if phone_number:
                        existing = session.exec(
                            select(Contact).where(Contact.phone_number == phone_number)
                        ).first()
                    elif email:
                        existing = session.exec(
                            select(Contact).where(Contact.email == email)
                        ).first()
                    
                    if not existing:
                        contact = Contact(
                            phone_number=phone_number,
                            email=email,
                            full_name=full_name
                        )
                        session.add(contact)
                        session.commit()
                        session.refresh(contact)
                        self._cleanup_records.append(("contact", contact.id))
                
                elif action == "create_inbox_message":
                    inbox_name = params["inbox_name"]
                    body = params["body"]
                    phone_number = params.get("phone_number")
                    email = params.get("email")
                    
                    inbox = session.exec(select(Inbox).where(Inbox.name == inbox_name)).first()
                    if not inbox:
                        raise ValueError(f"Inbox '{inbox_name}' not found")
                    
                    contact = None
                    if phone_number:
                        contact = session.exec(
                            select(Contact).where(Contact.phone_number == phone_number)
                        ).first()
                    elif email:
                        contact = session.exec(
                            select(Contact).where(Contact.email == email)
                        ).first()
                    
                    if not contact:
                        raise ValueError(f"Contact not found for phone_number={phone_number}, email={email}")
                    
                    inbox_message = InboxMessage(
                        inbox_id=inbox.id,
                        contact_id=contact.id,
                        body=body,
                        thread_id=None,
                        external_id=None
                    )
                    session.add(inbox_message)
                    session.commit()
                    session.refresh(inbox_message)
                    self._cleanup_records.append(("inbox_message", inbox_message.id))
    
    def _cleanup_setup_data(self) -> None:
        """Clean up database records created during setup"""
        with postgres_session() as session:
            for record_type, record_id in reversed(self._cleanup_records):
                if record_type == "inbox_message":
                    message = session.get(InboxMessage, record_id)
                    if message:
                        session.delete(message)
                elif record_type == "contact":
                    contact = session.get(Contact, record_id)
                    if contact:
                        session.delete(contact)
                elif record_type == "inbox":
                    inbox = session.get(Inbox, record_id)
                    if inbox:
                        session.delete(inbox)
            
            session.commit()
        self._cleanup_records.clear()
    
    def _evaluate_metric(self, metric: Union[BaseMetric, ExactMatchMetric, RegexMatchMetric], outputs: Dict[str, Any]) -> bool:
        """
        Evaluate a single metric against workflow outputs.
        
        Args:
            metric: Metric definition (Pydantic model)
            outputs: Dictionary of workflow outputs
        
        Returns:
            True if metric is satisfied, False otherwise
        """
        if metric.output_name not in outputs:
            return False
        
        actual_value = outputs[metric.output_name]
        
        if isinstance(metric, ExactMatchMetric):
            return actual_value == metric.expected_value
        elif isinstance(metric, RegexMatchMetric):
            if not isinstance(actual_value, str):
                return False
            if not isinstance(metric.target_expression, str):
                return False
            try:
                return bool(re.search(metric.target_expression, actual_value))
            except re.error:
                return False
        
        return False
    
    async def _execute_eval(self, eval_instance: BaseEval) -> Dict[str, Any]:
        """Execute the evaluation test case"""
        try:
            self._execute_setup_steps(eval_instance)
            
            start_time = time.time()
            workflow_result = self.workflow.run()
            latency = time.time() - start_time
            
            self._cleanup_setup_data()
            
            workflow_fulfilled = workflow_result.name == "workflow.execution.fulfilled"
            
            result = {
                "test_case": eval_instance.id,
                "latency": latency
            }
            
            if workflow_fulfilled:
                outputs = {k: v for k, v in workflow_result.outputs}
                result["workflow_result"] = outputs
                
                metrics = eval_instance.metrics
                if metrics:
                    total_weight = sum(m.weight for m in metrics)
                    failed_metrics = []
                    actual_score = 0
                    
                    for m in metrics:
                        passed = self._evaluate_metric(m, outputs)
                        if passed:
                            actual_score += m.weight
                        else:
                            actual_value = outputs.get(m.output_name, "<missing>")
                            if isinstance(m, ExactMatchMetric):
                                expected = m.expected_value
                                metric_type = "exact_match"
                            elif isinstance(m, RegexMatchMetric):
                                expected = m.target_expression
                                metric_type = "regex_match"
                            else:
                                expected = "<unknown>"
                                metric_type = m.type
                            
                            failed_metrics.append({
                                "output_name": m.output_name,
                                "type": metric_type,
                                "expected": expected,
                                "actual": str(actual_value)
                            })
                    
                    score = round(actual_score / total_weight, 2) if total_weight > 0 else 0.0
                    result["failed_metrics"] = failed_metrics
                else:
                    score = 1.0
                
                result["score"] = score
                result["success"] = score == 1.0
            else:
                result["workflow_result"] = {"error": workflow_result.error.model_dump()}
                result["score"] = 0.0
                result["success"] = False
            
            if hasattr(eval_instance, 'expected_trigger'):
                result["expected_trigger"] = eval_instance.expected_trigger
            
            return result
            
        except Exception as e:
            self._cleanup_setup_data()
            return {
                "test_case": eval_instance.id,
                "success": False,
                "error": str(e),
                "latency": 0.0,
                "score": 0.0
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
                if result.get('results'):
                    test_result = result['results'][0]
                    status = "✅ PASS" if test_result.get('success') else "❌ FAIL"
                    latency = test_result.get('latency', 0.0)
                    print(f"  {test_result.get('test_case', 'Unknown')}: {status} ({latency:.2f}s)")
                    
                    if test_result.get('failed_metrics'):
                        for fm in test_result['failed_metrics']:
                            print(f"    - {fm['output_name']} ({fm['type']}): expected '{fm['expected']}', got '{fm['actual']}')")
            
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
            if result.get('results'):
                test_result = result['results'][0]
                status = "✅ PASS" if test_result.get('success') else "❌ FAIL"
                latency = test_result.get('latency', 0.0)
                print(f"  {test_result.get('test_case', 'Unknown')}: {status} ({latency:.2f}s)")
                
                if test_result.get('failed_metrics'):
                    for fm in test_result['failed_metrics']:
                        print(f"    - {fm['output_name']} ({fm['type']}): expected '{fm['expected']}', got '{fm['actual']}')")
        
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
