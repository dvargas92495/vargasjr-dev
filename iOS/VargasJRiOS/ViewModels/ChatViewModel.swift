import Foundation

@MainActor
class ChatViewModel: ObservableObject {
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var currentSessionId: String?
    
    private let chatService = ChatService()
    
    func createChatSession(email: String, message: String) async -> Bool {
        isLoading = true
        errorMessage = nil
        
        do {
            let sessionId = try await chatService.createChatSession(email: email, message: message)
            currentSessionId = sessionId
            isLoading = false
            return true
        } catch {
            errorMessage = "Failed to create chat session: \(error.localizedDescription)"
            isLoading = false
            return false
        }
    }
}
