"use client";

import React from "react";
import { Vellum } from "vellum-ai";

interface WorkflowOutputDisplayProps {
  outputs: Vellum.WorkflowOutput[];
}

const WorkflowOutputDisplay = ({ outputs }: WorkflowOutputDisplayProps) => {
  const renderOutputValue = (output: Vellum.WorkflowOutput) => {
    switch (output.type) {
      case "STRING":
        return (
          <span className="text-gray-900 break-words">
            {JSON.stringify(output.value)}
          </span>
        );
      case "NUMBER":
        return (
          <span className="text-gray-900 font-mono">
            {JSON.stringify(output.value)}
          </span>
        );
      case "JSON":
      case "ARRAY":
      case "ERROR":
      case "CHAT_HISTORY":
      case "SEARCH_RESULTS":
      case "FUNCTION_CALL":
      case "IMAGE":
      default:
        return (
          <span className="text-gray-900 break-words font-mono text-sm">
            {JSON.stringify(output.value, null, 2)}
          </span>
        );
    }
  };

  if (!outputs || outputs.length === 0) {
    return <p className="text-sm text-gray-500 italic">No outputs generated</p>;
  }

  return (
    <div className="space-y-3">
      {outputs.map((output) => (
        <div key={output.id} className="bg-gray-50 p-3 rounded border">
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-medium text-gray-700 min-w-0 flex-shrink-0">
              {output.name}:
            </span>
            <div className="min-w-0 flex-1 text-right">
              {renderOutputValue(output)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default WorkflowOutputDisplay;
