interface AgentVersionDisplayProps {
  healthData?: {
    diagnostics?: {
      environment?: {
        agentVersion?: string;
      };
    };
  };
  instanceState: string;
}

const AgentVersionDisplay = ({
  healthData,
  instanceState,
}: AgentVersionDisplayProps) => {
  const getVersionText = () => {
    if (instanceState !== "running") {
      return "N/A";
    }
    
    if (!healthData) {
      return "Loading...";
    }
    
    const agentVersion = healthData.diagnostics?.environment?.agentVersion;
    return agentVersion || "Unknown";
  };

  return <span className="text-sm text-gray-900 font-mono">{getVersionText()}</span>;
};

export default AgentVersionDisplay;
