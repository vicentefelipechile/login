/* == i18n =================================================== */
const TRANSLATIONS = {
    en: {
        eyebrow: 'DEMO PROJECT',
        h1_html: 'Sign in with <em>OAuth 2.0</em>',
        subtitle: 'Educational login flow. Pick an identity provider below to go through the full authorization cycle.',
        select_provider: 'SELECT PROVIDER',
        how_it_works: 'how it works',
        note_html: 'Clicking redirects to the real provider. State &amp; PKCE verifiers go to <code>Cloudflare KV</code> (TTL 5 min). Callback exchanges the code, validates with <code>Zod</code>, upserts to <code>D1</code>, sets a session cookie.',
        session_active: 'SESSION ACTIVE',
        edit_profile: 'edit profile',
        log_out: 'log out',
        display_name_label: 'display_name',
        username_label: 'username',
        username_placeholder: 'lowercase, a-z, 0-9, _',
        save: 'save',
        cancel: 'cancel',
        saving: 'saving…',
        err_at_least_one: 'Provide at least one field',
        err_username_fmt: 'Must be 3–32 chars: lowercase letters, digits, underscores only',
        err_username_taken: 'Username already taken — try another',
        err_generic: 'Something went wrong',
        err_network: 'Network error — please try again',
    },
    es: {
        eyebrow: 'PROYECTO DEMO',
        h1_html: 'Inicia sesión con <em>OAuth 2.0</em>',
        subtitle: 'Flujo educativo de inicio de sesión. Elige un proveedor de identidad para vivir el ciclo de autorización completo.',
        select_provider: 'SELECCIONAR PROVEEDOR',
        how_it_works: 'cómo funciona',
        note_html: 'Al hacer clic redirige al proveedor real. Los verificadores de state y PKCE se guardan en <code>Cloudflare KV</code> (TTL 5 min). El callback intercambia el código, valida con <code>Zod</code>, hace upsert en <code>D1</code> y establece una cookie de sesión.',
        session_active: 'SESIÓN ACTIVA',
        edit_profile: 'editar perfil',
        log_out: 'cerrar sesión',
        display_name_label: 'nombre_visible',
        username_label: 'nombre_de_usuario',
        username_placeholder: 'minúsculas, a-z, 0-9, _',
        save: 'guardar',
        cancel: 'cancelar',
        saving: 'guardando…',
        err_at_least_one: 'Ingresa al menos un campo',
        err_username_fmt: 'Debe tener 3–32 caracteres: letras minúsculas, dígitos o guiones bajos',
        err_username_taken: 'Ese nombre de usuario ya está en uso — intenta otro',
        err_generic: 'Algo salió mal',
        err_network: 'Error de red — inténtalo de nuevo',
    }
}

let currentLang = 'en'

function setLang(lang) {
    currentLang = lang
    const t = TRANSLATIONS[lang]

    // update buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang)
    })

    // update html lang attr
    document.documentElement.lang = lang

    // text nodes
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n
        if (!t[key]) return
        if (key.endsWith('_html')) {
            el.innerHTML = t[key]
        } else {
            el.textContent = t[key]
        }
    })

    // placeholder attrs
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.dataset.i18nPlaceholder
        if (t[key]) el.placeholder = t[key]
    })
}

/* == Session / Profile ===================================== */
; (async () => {
    const loginView = document.getElementById('login-view')
    const profileCard = document.getElementById('profile-card')

    let user = null
    try {
        const res = await fetch('/me', { credentials: 'same-origin' })
        if (res.ok) user = await res.json()
    } catch { /* no session */ }

    if (!user) return

    loginView.style.display = 'none'
    profileCard.style.display = 'block'

    // Avatar
    const avatarContainer = document.getElementById('avatar-container')
    if (user.avatar_url) {
        const img = document.createElement('img')
        img.className = 'avatar'
        img.src = user.avatar_url
        img.alt = user.display_name
        avatarContainer.appendChild(img)
    } else {
        const div = document.createElement('div')
        div.className = 'avatar-initials'
        div.textContent = (user.display_name || user.username || '?')[0].toUpperCase()
        avatarContainer.appendChild(div)
    }

    document.getElementById('profile-display-name').textContent = user.display_name
    document.getElementById('profile-username').textContent = `@${user.username}`

    const badge = document.getElementById('provider-badge')
    badge.textContent = user.provider
    badge.className = `provider-badge badge-${user.provider}`

    // Inline edit
    const editForm = document.getElementById('edit-form')
    const openBtn = document.getElementById('open-edit-btn')
    const cancelBtn = document.getElementById('cancel-btn')
    const saveBtn = document.getElementById('save-btn')
    const inputName = document.getElementById('input-display-name')
    const inputUser = document.getElementById('input-username')
    const errName = document.getElementById('err-display-name')
    const errUser = document.getElementById('err-username')

    openBtn.addEventListener('click', () => {
        inputName.value = user.display_name
        inputUser.value = user.username
        editForm.style.display = 'block'
        openBtn.style.display = 'none'
        errName.style.display = errUser.style.display = 'none'
    })

    cancelBtn.addEventListener('click', () => {
        editForm.style.display = 'none'
        openBtn.style.display = 'flex'
    })

    inputUser.addEventListener('blur', () => {
        const val = inputUser.value
        const t = TRANSLATIONS[currentLang]
        if (val && !/^[a-z0-9_]{3,32}$/.test(val)) {
            errUser.textContent = t.err_username_fmt
            errUser.style.display = 'block'
        } else {
            errUser.style.display = 'none'
        }
    })

    saveBtn.addEventListener('click', async () => {
        errName.style.display = errUser.style.display = 'none'
        const t = TRANSLATIONS[currentLang]
        const body = {}
        const dn = inputName.value.trim()
        const un = inputUser.value.trim()
        if (dn) body.display_name = dn
        if (un) body.username = un

        if (!dn && !un) {
            errName.textContent = t.err_at_least_one
            errName.style.display = 'block'
            return
        }

        saveBtn.disabled = true
        saveBtn.textContent = t.saving

        try {
            const res = await fetch('/me', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                credentials: 'same-origin',
            })
            const data = await res.json()

            if (res.ok) {
                if (dn) { user.display_name = dn; document.getElementById('profile-display-name').textContent = dn }
                if (un) { user.username = un; document.getElementById('profile-username').textContent = `@${un}` }
                editForm.style.display = 'none'
                openBtn.style.display = 'flex'
            } else if (data.error === 'username_taken') {
                errUser.textContent = t.err_username_taken
                errUser.style.display = 'block'
            } else {
                errName.textContent = data.error || t.err_generic
                errName.style.display = 'block'
            }
        } catch {
            errName.textContent = TRANSLATIONS[currentLang].err_network
            errName.style.display = 'block'
        } finally {
            saveBtn.disabled = false
            saveBtn.textContent = TRANSLATIONS[currentLang].save
        }
    })
})()