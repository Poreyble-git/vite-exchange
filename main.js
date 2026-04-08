import './style.css'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gclkezaillkycgbhcqoy.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjbGtlemFpbGxreWNnYmhjcW95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MzkxNjksImV4cCI6MjA5MTIxNTE2OX0.0qg66_BchhM7ZLlR2X709xzEX8Pl6PqpDM3rcNmgpIs'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const messageBox = document.getElementById('message')
const ratesCards = document.getElementById('ratesCards')
const requestsBody = document.getElementById('requestsBody')
const pairSelect = document.getElementById('pairSelect')
const requestForm = document.getElementById('requestForm')
const userEmailInput = document.getElementById('userEmail')
const amountFromInput = document.getElementById('amountFrom')
const loadRatesBtn = document.getElementById('loadRatesBtn')
const loadRequestsBtn = document.getElementById('loadRequestsBtn')

let currentRates = []
let previousRatesMap = {}

function showMessage(text) {
  messageBox.style.display = 'block'
  messageBox.textContent = text
}

async function loadRates() {
  const { data, error } = await supabase
    .from('current_internal_rates')
    .select('*')
    .order('from_currency', { ascending: true })

  if (error) {
    showMessage('Ошибка загрузки курсов: ' + error.message)
    return
  }

  const newRates = data || []
  ratesCards.innerHTML = ''
  pairSelect.innerHTML = ''

  newRates.forEach((rate) => {
    const rateKey = `${rate.from_currency}_${rate.to_currency}`
    const oldRate = previousRatesMap[rateKey]

    let buyClass = 'rate-neutral'
    let sellClass = 'rate-neutral'
    let buyArrow = '—'
    let sellArrow = '—'
    let oldBuyText = 'нет данных'
    let oldSellText = 'нет данных'
    let buyDiffText = '0.000000'
    let sellDiffText = '0.000000'

    if (oldRate) {
      const buyDiff = Number(rate.buy_rate) - Number(oldRate.buy_rate)
      const sellDiff = Number(rate.sell_rate) - Number(oldRate.sell_rate)

      oldBuyText = Number(oldRate.buy_rate).toFixed(6)
      oldSellText = Number(oldRate.sell_rate).toFixed(6)
      buyDiffText = buyDiff.toFixed(6)
      sellDiffText = sellDiff.toFixed(6)

      if (buyDiff > 0) {
        buyClass = 'rate-up'
        buyArrow = '▲'
      } else if (buyDiff < 0) {
        buyClass = 'rate-down'
        buyArrow = '▼'
      }

      if (sellDiff > 0) {
        sellClass = 'rate-up'
        sellArrow = '▲'
      } else if (sellDiff < 0) {
        sellClass = 'rate-down'
        sellArrow = '▼'
      }
    }

    const card = document.createElement('div')
    card.className = 'rate-card'
    card.innerHTML = `
      <div class="rate-card-header">
        <div class="pair-title">${rate.from_currency} → ${rate.to_currency}</div>
        <div class="margin-badge">Маржа ${rate.margin_percent}%</div>
      </div>

      <div class="rate-block ${buyClass}">
        <div class="rate-label">Покупка</div>
        <div class="rate-main">${buyArrow} ${Number(rate.buy_rate).toFixed(6)}</div>
        <div class="rate-sub">Было: ${oldBuyText}</div>
        <div class="rate-sub">Изменение: ${buyDiffText}</div>
      </div>

      <div class="rate-block ${sellClass}">
        <div class="rate-label">Продажа</div>
        <div class="rate-main">${sellArrow} ${Number(rate.sell_rate).toFixed(6)}</div>
        <div class="rate-sub">Было: ${oldSellText}</div>
        <div class="rate-sub">Изменение: ${sellDiffText}</div>
      </div>
    `
    ratesCards.appendChild(card)
  })

  const { data: pairs, error: pairsError } = await supabase
    .from('pair_options_view')
    .select('*')

  if (pairsError) {
    showMessage('Ошибка загрузки валютных пар: ' + pairsError.message)
    return
  }

  pairs.forEach((pair) => {
    const option = document.createElement('option')
    option.value = pair.pair_id
    option.textContent = `${pair.from_currency} → ${pair.to_currency}`
    pairSelect.appendChild(option)
  })

  previousRatesMap = {}
  newRates.forEach((rate) => {
    const rateKey = `${rate.from_currency}_${rate.to_currency}`
    previousRatesMap[rateKey] = {
      buy_rate: rate.buy_rate,
      sell_rate: rate.sell_rate
    }
  })

  currentRates = newRates
}

async function loadRequests() {
  const { data, error } = await supabase
    .from('client_requests_view')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    showMessage('Ошибка загрузки заявок: ' + error.message)
    return
  }

  requestsBody.innerHTML = ''

  ;(data || []).forEach((req) => {
    const tr = document.createElement('tr')
    tr.innerHTML = `
      <td>${req.request_id}</td>
      <td>${req.full_name}</td>
      <td>${req.from_currency} → ${req.to_currency}</td>
      <td>${req.amount_from}</td>
      <td>${req.rate_used ?? ''}</td>
      <td>${req.amount_to ?? ''}</td>
      <td>${req.status}</td>
      <td>${new Date(req.created_at).toLocaleString()}</td>
    `
    requestsBody.appendChild(tr)
  })
}

async function createRequest(event) {
  event.preventDefault()

  const email = userEmailInput.value.trim()
  const pairId = Number(pairSelect.value)
  const amountFrom = Number(amountFromInput.value)

  if (!email || !pairId || !amountFrom) {
    showMessage('Заполни все поля')
    return
  }

  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single()

  if (userError || !userData) {
    showMessage('Пользователь с таким email не найден')
    return
  }

  const { data: statusData, error: statusError } = await supabase
    .from('request_statuses')
    .select('id')
    .eq('name', 'new')
    .single()

  if (statusError || !statusData) {
    showMessage('Не найден статус new')
    return
  }

  const { error } = await supabase
    .from('exchange_requests')
    .insert({
      user_id: userData.id,
      pair_id: pairId,
      amount_from: amountFrom,
      status_id: statusData.id,
      office_id: 1
    })

  if (error) {
    showMessage('Ошибка создания заявки: ' + error.message)
    return
  }

  showMessage('Заявка успешно создана')
  await loadRequests()
}

loadRatesBtn.addEventListener('click', async () => {
  showMessage('Обновляем курсы...')

  const { error } = await supabase.functions.invoke('update-rates')

  if (error) {
    showMessage('Ошибка API: ' + error.message)
    return
  }

  await loadRates()
  showMessage('Курсы обновлены и сравнены с предыдущими значениями')
})

loadRequestsBtn.addEventListener('click', loadRequests)
requestForm.addEventListener('submit', createRequest)

await loadRates()
await loadRequests()