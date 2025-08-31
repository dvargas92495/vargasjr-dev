import Foundation

class ChatService {
    static let shared = ChatService()
    
    private let baseURL = "https://www.vargasjr.dev/api"
    
    private init() {}
    
    func createChatSession(email: String, message: String) async throws -> String {
        guard let url = URL(string: "\(baseURL)/chat") else {
            throw ChatError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = [
            "email": email,
            "message": message
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ChatError.invalidResponse
        }
        
        guard httpResponse.statusCode == 200 else {
            throw ChatError.serverError(httpResponse.statusCode)
        }
        
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        guard let sessionId = json?["id"] as? String else {
            throw ChatError.invalidData
        }
        
        return sessionId
    }
    
    func fetchChatSession(sessionId: String) async throws -> ChatSession {
        guard let url = URL(string: "\(baseURL)/chat/\(sessionId)") else {
            throw ChatError.invalidURL
        }
        
        let (data, response) = try await URLSession.shared.data(from: url)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ChatError.invalidResponse
        }
        
        guard httpResponse.statusCode == 200 else {
            throw ChatError.serverError(httpResponse.statusCode)
        }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        
        return try decoder.decode(ChatSessionResponse.self, from: data).session
    }
    
    func sendContactMessage(email: String, message: String) async throws {
        guard let url = URL(string: "\(baseURL)/contact") else {
            throw ChatError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = [
            "email": email,
            "message": message
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (_, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ChatError.invalidResponse
        }
        
        guard httpResponse.statusCode == 200 else {
            throw ChatError.serverError(httpResponse.statusCode)
        }
    }
}

enum ChatError: Error, LocalizedError {
    case invalidURL
    case invalidResponse
    case invalidData
    case serverError(Int)
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .invalidData:
            return "Invalid data received"
        case .serverError(let code):
            return "Server error: \(code)"
        }
    }
}

struct ChatSession: Codable {
    let id: String
    let createdAt: Date
    let inboxName: String
    let contactEmail: String
    let contactName: String?
    let inboxId: String
}

struct ChatMessage: Codable {
    let id: String
    let body: String
    let source: String
    let createdAt: Date
}

struct ChatSessionResponse: Codable {
    let session: ChatSession
    let messages: [ChatMessage]
}
