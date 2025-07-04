import SwiftUI

struct MessageView: View {
    let message: String
    let isFromUser: Bool
    
    var body: some View {
        HStack {
            if isFromUser {
                Spacer()
            }
            
            Text(message)
                .padding(12)
                .background(isFromUser ? Color.blue : Color.gray.opacity(0.2))
                .foregroundColor(isFromUser ? .white : .primary)
                .cornerRadius(16)
                .frame(maxWidth: 280, alignment: isFromUser ? .trailing : .leading)
            
            if !isFromUser {
                Spacer()
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 4)
    }
}

struct MessageView_Previews: PreviewProvider {
    static var previews: some View {
        VStack {
            MessageView(message: "Hello, how can I help you today?", isFromUser: false)
            MessageView(message: "I need help with my project", isFromUser: true)
        }
    }
}
