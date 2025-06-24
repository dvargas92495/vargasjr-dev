import Foundation
import SwiftUI

@MainActor
class ChatViewModel: ObservableObject {
    @Published var currentSessionId: String?
    @Published var chatSession: ChatSession?
    @Published var messages: [ChatMessage] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    private let chatService = ChatService.shared
    
    func createChatSession(email: String, message: String) async -> Bool {
        isLoading = true
        errorMessage = nil
        
        do {
            let sessionId = try await chatService.createChatSession(email: email, message: message)
            currentSessionId = sessionId
            await loadChatSession(sessionId: sessionId)
            isLoading = false
            return true
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
            return false
        }
    }
    
    func loadChatSession(sessionId: String) async {
        isLoading = true
        errorMessage = nil
        
        do {
            let response = try await chatService.fetchChatSession(sessionId: sessionId)
            chatSession = response
            isLoading = false
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }
    
    func sendContactMessage(email: String, message: String) async -> Bool {
        isLoading = true
        errorMessage = nil
        
        do {
            try await chatService.sendContactMessage(email: email, message: message)
            isLoading = false
            return true
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
            return false
        }
    }
    
    func refreshSession() async {
        guard let sessionId = currentSessionId else { return }
        await loadChatSession(sessionId: sessionId)
    }
}
