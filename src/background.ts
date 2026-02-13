interface FetchShopByMessage {
  type: "FETCH_SHOPBY"
  url: string
}

interface FetchShopByResponse {
  success: boolean
  html?: string
  error?: string
}

chrome.runtime.onMessage.addListener(
  (
    message: FetchShopByMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: FetchShopByResponse) => void
  ) => {
    if (message.type === "FETCH_SHOPBY") {
      // Fetch через background worker обходит CORS
      fetch(message.url, {
        method: "GET",
        headers: {
          accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "ru,en;q=0.9",
          referer: "https://shop.by/",
          "user-agent": navigator.userAgent
        },
        credentials: "omit"
      })
        .then((response) => {
          if (response.status !== 200) {
            throw new Error(`HTTP ${response.status}`)
          }
          return response.text()
        })
        .then((html) => {
          sendResponse({ success: true, html })
        })
        .catch((error) => {
          console.error("[Shop.by Background] Ошибка запроса:", error)
          sendResponse({
            success: false,
            error: error.message || "Unknown error"
          })
        })

      // Возвращаем true для асинхронного sendResponse
      return true
    }
  }
)

console.log("[Shop.by Background] Service worker запущен")

export {}