"use client";

import React from "react";

export interface WorkflowOutput {
  id: string;
  name: string;
  type: string;
  value: unknown;
}

interface WorkflowOutputDisplayProps {
  outputs: WorkflowOutput[];
}

const WorkflowOutputDisplay = ({ outputs }: WorkflowOutputDisplayProps) => {
  const renderOutputValue = (output: WorkflowOutput) => {
    switch (output.type) {
      case "STRING":
        return (
          <span className="text-gray-900 break-words">
            {String(output.value)}
          </span>
        );
      case "NUMBER":
        return (
          <span className="text-gray-900 font-mono">
            {typeof output.value === 'number' ? output.value.toLocaleString() : String(output.value)}
          </span>
        );
      case "BOOLEAN":
        return (
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${
              output.value === true
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {String(output.value)}
          </span>
        );
      default:
        return (
          <span className="text-gray-900 break-words">
            {String(output.value)}
          </span>
        );
    }
  };

  if (!outputs || outputs.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic">No outputs generated</p>
    );
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
