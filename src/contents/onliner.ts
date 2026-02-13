import type { PlasmoCSConfig } from "plasmo"
import { Storage } from "@plasmohq/storage"

export const config: PlasmoCSConfig = {
  matches: ["https://catalog.onliner.by/*", "https://www.onliner.by/*"],
  run_at: "document_idle"
}

const storage = new Storage()

// Настройки кеширования
const CACHE_DURATION = 6 * 60 * 60 * 1000 // 6 часов в миллисекундах
const CACHE_KEY_PREFIX = "shopby_cache_"

interface ShopByData {
  price: string
  url: string
  shopCount: string
}

interface CacheEntry {
  timestamp: number
  shopData: ShopByData | null
}

// Функции работы с кешем
function getCacheKey(productName: string): string {
  return (
    CACHE_KEY_PREFIX +
    btoa(encodeURIComponent(productName)).replace(/[^a-zA-Z0-9]/g, "_")
  )
}

async function getCachedData(
  productName: string
): Promise<{ found: boolean; data: ShopByData | null }> {
  try {
    const cacheKey = getCacheKey(productName)
    const cached = await storage.get<CacheEntry>(cacheKey)

    if (!cached) return { found: false, data: null }

    const now = Date.now()

    // Проверяем, не истек ли срок действия кеша
    if (now - cached.timestamp > CACHE_DURATION) {
      await storage.remove(cacheKey)
      console.log("[Shop.by] Кеш устарел для:", productName)
      return { found: false, data: null }
    }

    if (cached.shopData === null) {
      console.log("[Shop.by] Товар не найден (из кеша):", productName)
    } else {
      console.log("[Shop.by] Данные взяты из кеша:", productName)
    }

    return { found: true, data: cached.shopData }
  } catch (e) {
    console.error("[Shop.by] Ошибка чтения кеша:", e)
    return { found: false, data: null }
  }
}

async function setCachedData(
  productName: string,
  shopData: ShopByData | null
): Promise<void> {
  try {
    const cacheKey = getCacheKey(productName)
    const cacheEntry: CacheEntry = {
      timestamp: Date.now(),
      shopData: shopData
    }
    await storage.set(cacheKey, cacheEntry)

    if (shopData === null) {
      console.log("[Shop.by] Сохранён отрицательный результат в кеш:", productName)
    } else {
      console.log("[Shop.by] Данные сохранены в кеш:", productName)
    }
  } catch (e) {
    console.error("[Shop.by] Ошибка записи в кеш:", e)
  }
}

async function searchOnShopBy(
  productName: string
): Promise<ShopByData | null> {
  const encodedName = encodeURIComponent(productName)
  const url = `https://shop.by/find/?findtext=${encodedName}&sort=price--number`

  try {
    // Отправляем запрос через background worker (обходит CORS)
    const response = await chrome.runtime.sendMessage({
      type: "FETCH_SHOPBY",
      url: url
    })

    if (!response || !response.success) {
      throw new Error(response?.error || "Failed to fetch")
    }

    const html = response.html
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")

    // Проверяем наличие результатов
    const noResults = doc.querySelector(".PageFind__Noresults")
    if (noResults) {
      return null
    }

    const modelList = doc.querySelector(".ModelList")
    if (!modelList) {
      return null
    }

    // Ищем первую карточку (модель или товар магазина)
    const modelCard = modelList.querySelector(".ModelList__ModelBlockItem")
    const shopCard = modelList.querySelector(".ShopItemList__BlockItem")

    const firstCard = modelCard || shopCard
    if (!firstCard) {
      return null
    }

    let price: string | null = null
    let shopCount: string | null = null
    const productUrl = url

    if (modelCard) {
      // Карточка модели товара
      const priceEl = modelCard.querySelector(".PriceBlock__PriceValue")
      const countEl = modelCard.querySelector(".ModelList__CountShopsLink")

      price = priceEl ? priceEl.textContent.replace(/\s+/g, " ").trim() : null

      if (countEl) {
        shopCount = countEl.textContent.trim()
      } else {
        // Подсчитываем количество карточек на странице
        const itemsOnPage = modelList.querySelectorAll(
          ".ModelList__ModelBlockItem, .ShopItemList__BlockItem"
        ).length

        // Проверяем наличие пагинации
        const pagination = doc.querySelector(".Paging__InnerPages")
        if (pagination) {
          const pageLinks = pagination.querySelectorAll(
            ".Paging__PageLink:not(.Paging__DisabledFirstPage):not(.Paging__PageActive):not(.Paging__LastPage)"
          )
          const totalPages = pageLinks.length + 1
          const estimatedTotal = itemsOnPage * totalPages
          shopCount = `~${estimatedTotal} предложений`
        } else {
          shopCount = `${itemsOnPage} ${
            itemsOnPage === 1
              ? "предложение"
              : itemsOnPage < 5
                ? "предложения"
                : "предложений"
          }`
        }
      }
    } else {
      // Карточка товара от магазина
      const priceEl = shopCard.querySelector(".PriceBlock__PriceFirst")

      price = priceEl ? priceEl.textContent.replace(/\s+/g, " ").trim() : null

      // Для товаров магазинов считаем все карточки
      const totalItems = modelList.querySelectorAll(
        ".ShopItemList__BlockItem"
      ).length

      const pagination = doc.querySelector(".Paging__InnerPages")
      if (pagination) {
        const pageLinks = pagination.querySelectorAll(
          ".Paging__PageLink:not(.Paging__DisabledFirstPage):not(.Paging__PageActive):not(.Paging__LastPage)"
        )
        const totalPages = pageLinks.length + 1
        const estimatedTotal = totalItems * totalPages
        shopCount = `~${estimatedTotal} предложений`
      } else {
        shopCount = `${totalItems} ${
          totalItems === 1
            ? "предложение"
            : totalItems < 5
              ? "предложения"
              : "предложений"
        }`
      }
    }

    if (price) {
      return {
        price: price,
        url: productUrl,
        shopCount: shopCount || ""
      }
    } else {
      return null
    }
  } catch (e) {
    console.error("[Shop.by] Ошибка при запросе:", e)
    throw e
  }
}

async function getShopByData(productName: string): Promise<ShopByData | null> {
  // Проверяем кеш
  const cacheResult = await getCachedData(productName)
  if (cacheResult.found) {
    // Запись в кеше найдена (даже если data === null)
    return cacheResult.data
  }

  // Если в кеше нет, делаем запрос
  console.log("[Shop.by] Запрос к API для:", productName)
  const shopData = await searchOnShopBy(productName)

  // Сохраняем результат в кеш (даже если null)
  await setCachedData(productName, shopData)

  return shopData
}

function extractProductName(container: Element): string | null {
  // Блок #1: catalog-form__offers-part_data
  let nameEl = container.querySelector(
    ".catalog-form__offers-part_data .catalog-form__link"
  )
  if (nameEl) {
    return nameEl.textContent?.trim() || null
  }

  // Блок #2-3: product-summary__caption
  nameEl = container.querySelector(".product-summary__caption")
  if (nameEl) {
    return nameEl.textContent?.trim() || null
  }

  // Блок #4: catalog-masthead__title
  nameEl = container.querySelector(".catalog-masthead__title")
  if (nameEl) {
    return nameEl.textContent?.trim() || null
  }

  return null
}

function addShopByPrice(container: Element, shopData: ShopByData): void {
  if (container.querySelector(".shopby-price-badge")) {
    return
  }

  let insertTarget: Element | null = null

  // Блок #1: После цены в catalog-form__link
  const priceLink = container.querySelector(
    ".catalog-form__offers-part_control .catalog-form__link"
  )
  if (priceLink) {
    insertTarget = priceLink.parentElement
  }

  // Блок #2-3: После product-summary__price
  if (!insertTarget) {
    insertTarget = container.querySelector(".product-summary__price")
  }

  // Блок #4: После первой цены product-aside__description
  if (!insertTarget) {
    const priceElements = document.querySelectorAll(
      ".product-aside__description"
    )
    for (let el of priceElements) {
      if (
        el.textContent?.includes("р.") &&
        el.textContent.trim().match(/^\d+[,\s\d]*р\./)
      ) {
        insertTarget = el
        break
      }
    }
  }

  if (!insertTarget) {
    console.warn("[Shop.by] Не найдено место для вставки")
    return
  }

  const badge = document.createElement("div")
  badge.className = "shopby-price-badge"
  badge.style.cssText = `
            display: block;
            margin: 8px 0;
            padding: 8px 12px;
            background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
            border-radius: 6px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        `

  badge.innerHTML = `
            <a href="${shopData.url}" target="_blank" style="color: white; text-decoration: none; display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                    <circle cx="9" cy="21" r="1"></circle>
                    <circle cx="20" cy="21" r="1"></circle>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                </svg>
                <div>
                    <div>Shop.by: ${shopData.price}</div>
                    ${shopData.shopCount ? `<div style="font-size: 11px; opacity: 0.85; margin-top: 2px;">${shopData.shopCount}</div>` : ""}
                </div>
            </a>
        `

  insertTarget.insertAdjacentElement("afterend", badge)
  console.log("[Shop.by] Цена добавлена:", shopData.price)
}

async function processCard(card: Element): Promise<void> {
  const htmlCard = card as HTMLElement
  if (htmlCard.dataset.shopbyProcessed === "true") return
  htmlCard.dataset.shopbyProcessed = "true"

  const productName = extractProductName(card)
  if (!productName) {
    console.warn("[Shop.by] Не удалось извлечь название")
    return
  }

  console.log("[Shop.by] Обработка:", productName)

  try {
    const shopData = await getShopByData(productName)
    if (shopData) {
      addShopByPrice(card, shopData)
    } else {
      console.log("[Shop.by] Товар не найден на shop.by")
    }
  } catch (error) {
    console.error("[Shop.by] Ошибка:", error)
  }
}

function findCards(): Element[] {
  return [
    ...document.querySelectorAll(".catalog-form__offers-unit"), // Блок #1
    ...document.querySelectorAll(".product-summary"), // Блок #2-3
    ...document.querySelectorAll(".catalog-masthead") // Блок #4
  ]
}

async function processAllCards(): Promise<void> {
  const cards = findCards()
  console.log(`[Shop.by] Найдено карточек: ${cards.length}`)

  for (const card of cards) {
    // Проверяем, есть ли данные в кеше
    const productName = extractProductName(card)
    if (!productName) continue

    const cacheResult = await getCachedData(productName)

    if (cacheResult.found) {
      // Если данные в кеше - обрабатываем без задержки
      await processCard(card)
    } else {
      // Если нет в кеше - обрабатываем с задержкой
      await processCard(card)
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
}

let observer: MutationObserver | null = null

function init(): void {
  console.log("[Shop.by] Инициализация")
  processAllCards()

  observer = new MutationObserver(() => {
    processAllCards()
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true
  })
}

// Запуск с задержкой для загрузки динамического контента
setTimeout(init, 2000)