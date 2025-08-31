import Foundation

class ChatService {
    private let baseURL = "https://www.vargasjr.dev/api"
    
    func createChatSession(email: String, message: String) async throws -> String {
        guard let url = URL(string: "\(baseURL)/chat") else {
            throw ChatServiceError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let requestBody = [
            "email": email,
            "message": message
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: requestBody)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw ChatServiceError.serverError
        }
        
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let sessionId = json["id"] as? String else {
            throw ChatServiceError.invalidResponse
        }
        
        return sessionId
    }
}

enum ChatServiceError: Error, LocalizedError {
    case invalidURL
    case serverError
    case invalidResponse
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .serverError:
            return "Server error occurred"
        case .invalidResponse:
            return "Invalid response from server"
        }
    }
}
