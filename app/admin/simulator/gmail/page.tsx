export default function GmailSimulatorPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Gmail Simulator</h1>
        <p className="text-sm text-gray-500">Simulate Gmail integration preview environment</p>
      </div>

      <div className="bg-white border border-gray-300 rounded-lg">
        <div className="bg-gray-500 px-6 py-3 rounded-t-lg">
          <h2 className="text-lg font-semibold text-white">Preview Environment</h2>
        </div>
        <div className="p-6">
          <div className="bg-gray-50 border border-gray-200 rounded p-4">
            <div className="text-sm text-gray-600 space-y-1">
              <div><strong>Status:</strong> <span className="text-green-600">Connected</span></div>
              <div><strong>Account:</strong> vargas.jr.dev@gmail.com</div>
              <div><strong>API Quota:</strong> 1,000,000 requests/day</div>
              <div><strong>Last Sync:</strong> 5 minutes ago</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
