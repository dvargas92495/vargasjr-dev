export default function SimulatorPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">App Simulator</h1>
        <p className="text-sm text-gray-500">Simulate preview environments for different applications</p>
      </div>

      <div className="bg-white border border-gray-300 rounded-lg">
        <div className="bg-gray-500 px-6 py-3 rounded-t-lg">
          <h2 className="text-lg font-semibold text-white">Slack Simulator</h2>
        </div>
        <div className="p-6">
          <div className="bg-gray-50 border border-gray-200 rounded p-4 mb-4">
            <h3 className="font-medium text-gray-800 mb-2">Preview Environment</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <div><strong>Status:</strong> <span className="text-green-600">Active</span></div>
              <div><strong>Workspace:</strong> vargas-jr-dev.slack.com</div>
              <div><strong>Bot Token:</strong> xoxb-****-****-****</div>
              <div><strong>Last Activity:</strong> 2 minutes ago</div>
            </div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-purple-500 rounded flex items-center justify-center text-white font-bold text-sm">
                VJ
              </div>
              <div>
                <div className="font-medium text-gray-800">VargasJR Bot</div>
                <div className="text-xs text-gray-500">Online</div>
              </div>
            </div>
            <div className="bg-white rounded p-3 shadow-sm">
              <div className="text-sm text-gray-700">
                <div className="font-medium mb-1">#general</div>
                <div className="text-gray-600">Ready to assist with development tasks! 🚀</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-300 rounded-lg">
        <div className="bg-gray-500 px-6 py-3 rounded-t-lg">
          <h2 className="text-lg font-semibold text-white">Gmail Simulator</h2>
        </div>
        <div className="p-6">
          <div className="bg-gray-50 border border-gray-200 rounded p-4 mb-4">
            <h3 className="font-medium text-gray-800 mb-2">Preview Environment</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <div><strong>Status:</strong> <span className="text-green-600">Connected</span></div>
              <div><strong>Account:</strong> vargas.jr.dev@gmail.com</div>
              <div><strong>API Quota:</strong> 1,000,000 requests/day</div>
              <div><strong>Last Sync:</strong> 5 minutes ago</div>
            </div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                G
              </div>
              <div>
                <div className="font-medium text-gray-800">Gmail Integration</div>
                <div className="text-xs text-gray-500">Active</div>
              </div>
            </div>
            <div className="bg-white rounded p-3 shadow-sm">
              <div className="text-sm">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-gray-800">Inbox</span>
                  <span className="text-xs text-gray-500">3 unread</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                    <span className="text-gray-700">New client inquiry</span>
                    <span className="text-xs text-gray-500">2m ago</span>
                  </div>
                  <div className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
                    <span className="text-gray-700">Project update request</span>
                    <span className="text-xs text-gray-500">1h ago</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-300 rounded-lg">
        <div className="bg-gray-500 px-6 py-3 rounded-t-lg">
          <h2 className="text-lg font-semibold text-white">Twitter Simulator</h2>
        </div>
        <div className="p-6">
          <div className="bg-gray-50 border border-gray-200 rounded p-4 mb-4">
            <h3 className="font-medium text-gray-800 mb-2">Preview Environment</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <div><strong>Status:</strong> <span className="text-green-600">Authenticated</span></div>
              <div><strong>Account:</strong> @VargasJRDev</div>
              <div><strong>API Version:</strong> v2</div>
              <div><strong>Rate Limit:</strong> 300 requests/15min</div>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                T
              </div>
              <div>
                <div className="font-medium text-gray-800">Twitter Bot</div>
                <div className="text-xs text-gray-500">@VargasJRDev</div>
              </div>
            </div>
            <div className="bg-white rounded p-3 shadow-sm">
              <div className="text-sm">
                <div className="font-medium text-gray-800 mb-2">Recent Activity</div>
                <div className="space-y-3">
                  <div className="border-l-2 border-blue-200 pl-3">
                    <div className="text-gray-700">🚀 Just deployed a new feature for automated code reviews!</div>
                    <div className="text-xs text-gray-500 mt-1">2 hours ago • 12 likes • 3 retweets</div>
                  </div>
                  <div className="border-l-2 border-gray-200 pl-3">
                    <div className="text-gray-700">Working on improving our AI development workflows 🤖</div>
                    <div className="text-xs text-gray-500 mt-1">1 day ago • 8 likes • 2 retweets</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
