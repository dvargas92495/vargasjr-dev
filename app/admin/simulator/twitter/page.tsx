export default function TwitterSimulatorPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Twitter Simulator</h1>
        <p className="text-sm text-gray-500">Simulate Twitter integration preview environment</p>
      </div>

      <div className="bg-white border border-gray-300 rounded-lg">
        <div className="bg-gray-500 px-6 py-3 rounded-t-lg">
          <h2 className="text-lg font-semibold text-white">Preview Environment</h2>
        </div>
        <div className="p-6">
          <div className="bg-gray-50 border border-gray-200 rounded p-4">
            <div className="text-sm text-gray-600 space-y-1">
              <div><strong>Status:</strong> <span className="text-green-600">Authenticated</span></div>
              <div><strong>Account:</strong> @VargasJRDev</div>
              <div><strong>API Version:</strong> v2</div>
              <div><strong>Rate Limit:</strong> 300 requests/15min</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
