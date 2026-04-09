import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const adminLoginForm = document.getElementById('adminLoginForm')
const adminPasswordInput = document.getElementById('adminPassword')
const adminMessage = document.getElementById('adminMessage')
const loginCard = document.getElementById('loginCard')
const adminPanel = document.getElementById('adminPanel')
const adminRequestsBody = document.getElementById('adminRequestsBody')

const ADMIN_PASSWORD = '1234'

function showAdminMessage(text) {
  adminMessage.style.display = 'block'
  adminMessage.textContent = text
}

function unlockAdmin() {
  loginCard.style.display = 'none'
  adminPanel.style.display = 'block'
  localStorage.setItem('admin_access', 'granted')
  loadAdminRequests()
}

adminLoginForm.addEventListener('submit', (e) => {
  e.preventDefault()

  if (adminPasswordInput.value === ADMIN_PASSWORD) {
    unlockAdmin()
  } else {
    showAdminMessage('Неверный пароль')
  }
})

if (localStorage.getItem('admin_access') === 'granted') {
  unlockAdmin()
}

async function loadAdminRequests() {
  const { data, error } = await supabase
    .from('client_requests_view')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    showAdminMessage('Ошибка загрузки заявок: ' + error.message)
    return
  }

  adminRequestsBody.innerHTML = ''

  for (const req of data || []) {
    const tr = document.createElement('tr')
    tr.innerHTML = `
      <td>${req.request_id}</td>
      <td>${req.full_name}</td>
      <td>${req.email ?? ''}</td>
      <td>${req.from_currency} → ${req.to_currency}</td>
      <td>${req.amount_from}</td>
      <td>${req.rate_used ?? ''}</td>
      <td>${req.amount_to ?? ''}</td>
      <td>${req.status}</td>
      <td>${new Date(req.created_at).toLocaleString()}</td>
      <td>
        <div style="display:grid; gap:6px;">
         <button data-id="${req.request_id}" data-action="approved">Одобрить</button>
         <button data-id="${req.request_id}" data-action="rejected">Отклонить</button>
         <button data-id="${req.request_id}" data-action="completed">Завершить</button>
        </div>
      </td>
`
    adminRequestsBody.appendChild(tr)
  }

  bindAdminActions()
}

function bindAdminActions() {
  document.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', async () => {
      const requestId = Number(button.dataset.id)
      const action = button.dataset.action

      const { data: statusData, error: statusError } = await supabase
        .from('request_statuses')
        .select('id')
        .eq('name', action)
        .single()

      if (statusError || !statusData) {
        showAdminMessage('Не найден статус: ' + action)
        return
      }

      const updatePayload = {
        status_id: statusData.id
      }

      if (action === 'completed') {
        updatePayload.processed_by_employee_id = 2
        updatePayload.office_id = 1
      }

      const { error } = await supabase
        .from('exchange_requests')
        .update(updatePayload)
        .eq('id', requestId)

      if (error) {
        showAdminMessage('Ошибка изменения статуса: ' + error.message)
        return
      }

      await loadAdminRequests()
    })
  })
}