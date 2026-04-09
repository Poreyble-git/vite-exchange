import './style.css'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const messageBox = document.getElementById('message')
const ratesCards = document.getElementById('ratesCards')
const requestsBody = document.getElementById('requestsBody')
const pairSelect = document.getElementById('pairSelect')
const requestForm = document.getElementById('requestForm')
const userEmailInput = document.getElementById('userEmail')
const clientFullNameInput = document.getElementById('clientFullName')
const amountFromInput = document.getElementById('amountFrom')
const loadRequestsBtn = document.getElementById('loadRequestsBtn')

let charts = {}
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
  const fullName = clientFullNameInput.value.trim()
  const pairId = Number(pairSelect.value)
  const amountFrom = Number(amountFromInput.value)

  if (!email || !fullName || !pairId || !amountFrom) {
    showMessage('Заполни все поля')
    return
  }

  let userId = null

  const { data: existingUser, error: existingUserError } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('email', email)
    .limit(1)
    .maybeSingle()

  if (existingUserError) {
    showMessage('Ошибка поиска клиента: ' + existingUserError.message)
    return
  }

  if (existingUser) {
    userId = existingUser.id

    if (existingUser.full_name !== fullName) {
      const { error: updateUserError } = await supabase
        .from('users')
        .update({ full_name: fullName })
        .eq('id', userId)

      if (updateUserError) {
        showMessage('Ошибка обновления ФИО клиента: ' + updateUserError.message)
        return
      }
    }
  } else {
    const { data: clientRole, error: roleError } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'client')
      .single()

    if (roleError || !clientRole) {
      showMessage('Не найдена роль client')
      return
    }

    const { data: newUser, error: newUserError } = await supabase
      .from('users')
      .insert({
        full_name: fullName,
        email: email,
        password_hash: 'autogenerated_client',
        role_id: clientRole.id
      })
      .select('id')
      .single()

    if (newUserError || !newUser) {
      showMessage('Ошибка создания клиента: ' + newUserError.message)
      return
    }

    userId = newUser.id

    const { error: clientInsertError } = await supabase
      .from('clients')
      .insert({
        user_id: userId,
        passport_number: null,
        phone: null
      })

    if (clientInsertError) {
      showMessage('Ошибка создания записи клиента: ' + clientInsertError.message)
      return
    }
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
      user_id: userId,
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
  userEmailInput.value = ''
  clientFullNameInput.value = ''
  amountFromInput.value = '100'
}

loadRatesBtn.addEventListener('click', async () => {
  showMessage('Обновляем курсы...')

  const { error } = await supabase.functions.invoke('update-rates')

  if (error) {
    showMessage('Ошибка API: ' + error.message)
    return
  }

  await loadRates()
  await loadCharts()
  showMessage('Курсы обновлены и сравнены с предыдущими значениями')
})

async function loadCharts() {
  const { data, error } = await supabase
    .from('internal_rates')
    .select(`
      buy_rate,
      effective_from,
      pair_id
    `)
    .order('effective_from', { ascending: true })

  if (error) {
    showMessage('Ошибка загрузки графиков: ' + error.message)
    return
  }

  const { data: pairsData, error: pairsError } = await supabase
    .from('pair_options_view')
    .select('*')

  if (pairsError) {
    showMessage('Ошибка загрузки пар для графиков: ' + pairsError.message)
    return
  }

  const getPairId = (from, to) => {
    const found = pairsData.find(p => p.from_currency === from && p.to_currency === to)
    return found ? found.pair_id : null
  }

  const pairMap = {
    usdRub: getPairId('USD', 'RUB'),
    usdEur: getPairId('USD', 'EUR'),
    usdCny: getPairId('USD', 'CNY')
  }

  renderChart('chartUsdRub', data, pairMap.usdRub, 'USD → RUB')
  renderChart('chartUsdEur', data, pairMap.usdEur, 'USD → EUR')
  renderChart('chartUsdCny', data, pairMap.usdCny, 'USD → CNY')
}

function renderChart(canvasId, allRates, pairId, label) {
  if (!pairId) return

  const canvas = document.getElementById(canvasId)
  if (!canvas) return

  const filtered = allRates
    .filter(item => item.pair_id === pairId)
    .slice(-10)

  const labels = filtered.map(item =>
    new Date(item.effective_from).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  )

  const values = filtered.map(item => Number(item.buy_rate))

  if (charts[canvasId]) {
    charts[canvasId].destroy()
  }

  charts[canvasId] = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label,
          data: values,
          borderWidth: 2,
          tension: 0.25
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      }
    }
  })
}

requestForm.addEventListener('submit', createRequest)

function init() {
  loadRates()
  loadCharts()
}

init()