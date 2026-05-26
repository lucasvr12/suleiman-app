/**
 * LÓGICA INTERACTIVA DEL CLIENTE (SPA) - ALLIANZ OPTIMAXX PLUS NL
 * Desarrollado en Vanilla JavaScript para máxima rapidez y compatibilidad.
 */

// Fecha de referencia actual del sistema (25 de Mayo de 2026)
const CURRENT_DATE_LIMIT = new Date('2026-05-25T17:35:00-06:00');

// Estado de la Aplicación (SPA State)
const state = {
    lead: {
        nombre: '',
        correo: '',
        whatsapp: '',
        edad: '',
        estado_civil: '',
        tiene_hijos: '',
        seguros: [],
        profesion: '',
        capacidad_ahorro: '',
        declara_impuestos: '',
        edad_retiro: '',
        inversiones_actuales: '',
        donde_invierte: [],
        tipo_inversionista: '',
        comentarios: '',
        fecha_cita: null
    },
    calendar: {
        currentYear: 2026,
        currentMonth: 4, // Mayo (0-indexed en JS, por ende 4)
        selectedDate: null, // Objeto Date seleccionado
        selectedSlot: null, // "HH:MM"
        blockedTimes: [] // Lista de strings ISO "YYYY-MM-DDTHH:mm:00"
    }
};

// Horarios de asesoría (Slots de 45 min)
const TIME_SLOTS = [
    "09:00", "09:45", "10:30", "11:15", "12:00", "12:45",
    "13:30", "14:15", "15:00", "15:45", "16:30", "17:15"
];

const MESES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

// URLs del Servidor (Redirigido a Google Apps Script Web App unificado en la nube)
const API_URL = "https://script.google.com/macros/s/AKfycbw3Q-EpcVn886IOacW83le0PZFmkP86AyONFH6uYFceT8rmf8pcUvyotHQuFtibtUmhEg/exec";
const API_LEADS = API_URL;
const API_BLOQUEOS = API_URL;

// Inicializar la SPA al cargar el DOM
document.addEventListener("DOMContentLoaded", () => {
    initNavigation();
    initFormValidation();
    initCalendarNav();
    initModal();
    initCustomFormInteractions();
});

/* ==========================================================================
   NAVEGACIÓN Y SCROLL SUAVE
   ========================================================================== */
function initNavigation() {
    const ctaHero = document.getElementById("hero-cta-btn");
    const navBtn = document.getElementById("nav-action-btn");
    const cuestionarioSec = document.getElementById("cuestionario");

    const scrollToCuestionario = (e) => {
        e.preventDefault();
        cuestionarioSec.scrollIntoView({ behavior: "smooth" });
    };

    if (ctaHero) ctaHero.addEventListener("click", scrollToCuestionario);
    if (navBtn) navBtn.addEventListener("click", scrollToCuestionario);
    
    // Logo scroll to top
    const logo = document.getElementById("brand-logo");
    if (logo) {
        logo.addEventListener("click", (e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    }
}

/* ==========================================================================
   INTERACCIONES AVANZADAS DE FORMULARIO DE DIAGNÓSTICO
   ========================================================================== */
function initCustomFormInteractions() {
    // 1. Mostrar/ocultar condicional de inversiones
    const invSelect = document.getElementById("inversiones_actuales");
    const condContainer = document.getElementById("inversiones-condicional");

    if (invSelect && condContainer) {
        invSelect.addEventListener("change", () => {
            if (invSelect.value === "Sí") {
                condContainer.classList.add("show");
            } else {
                condContainer.classList.remove("show");
                // Limpiar checkboxes si se oculta
                const checks = condContainer.querySelectorAll("input[type='checkbox']");
                checks.forEach(c => {
                    c.checked = false;
                    c.parentElement.classList.remove("selected");
                });
            }
        });
    }

    // 2. Micro-interacción premium de selección de Tarjetas de Checkbox y Radio
    const checkboxes = document.querySelectorAll(".checkbox-label input[type='checkbox']");
    checkboxes.forEach(cb => {
        // Inicializar estado visual por si está precargado
        if (cb.checked) cb.parentElement.classList.add("selected");

        cb.addEventListener("change", () => {
            if (cb.checked) {
                // Si es "Ninguno" en seguros, desmarcar los demás
                if (cb.value === "Ninguno") {
                    checkboxes.forEach(other => {
                        if (other !== cb && other.name === cb.name) {
                            other.checked = false;
                            other.parentElement.classList.remove("selected");
                        }
                    });
                } else {
                    // Si se marca otro, desmarcar "Ninguno"
                    const ninguno = Array.from(checkboxes).find(o => o.value === "Ninguno" && o.name === cb.name);
                    if (ninguno) {
                        ninguno.checked = false;
                        ninguno.parentElement.classList.remove("selected");
                    }
                }
                cb.parentElement.classList.add("selected");
            } else {
                cb.parentElement.classList.remove("selected");
            }
        });
    });
}

/* ==========================================================================
   VALIDACIÓN DE FORMULARIO Y LÓGICA DE FILTRADO CONDICIONAL
   ========================================================================== */
function initFormValidation() {
    const form = document.getElementById("lead-form");
    const nombreInput = document.getElementById("nombre");
    const correoInput = document.getElementById("correo");
    const whatsappInput = document.getElementById("whatsapp");
    const edadInput = document.getElementById("edad");
    const estadoCivilSelect = document.getElementById("estado_civil");
    const tieneHijosSelect = document.getElementById("tiene_hijos");
    const profesionSelect = document.getElementById("profesion");
    const ahorroSelect = document.getElementById("capacidad_ahorro");
    const declaraSelect = document.getElementById("declara_impuestos");
    const edadRetiroInput = document.getElementById("edad_retiro");
    const invActualesSelect = document.getElementById("inversiones_actuales");
    const tipoInversionistaSelect = document.getElementById("tipo_inversionista");
    const comentariosText = document.getElementById("comentarios");

    const btnContinuar = document.getElementById("btn-continuar");
    const spinner = document.getElementById("form-spinner");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        // Limpiar errores previos
        clearErrors();

        let isValid = true;

        // Validar Nombre
        if (nombreInput.value.trim().length < 3) {
            showError("nombre", "Por favor ingresa tu nombre completo (mínimo 3 letras).");
            isValid = false;
        }

        // Validar Correo
        const correoVal = correoInput.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(correoVal)) {
            showError("correo", "Ingresa un correo electrónico válido (ejemplo@dominio.com).");
            isValid = false;
        }

        // Validar WhatsApp (10 dígitos exactos)
        const whatsappVal = whatsappInput.value.trim();
        const phoneRegex = /^[0-9]{10}$/;
        if (!phoneRegex.test(whatsappVal)) {
            showError("whatsapp", "Por favor ingresa un número de WhatsApp a 10 dígitos (ej. 8112345678).");
            isValid = false;
        }

        // Validar Edad
        const edadVal = parseInt(edadInput.value);
        if (isNaN(edadVal) || edadVal < 18 || edadVal > 99) {
            showError("edad", "Debes ingresar una edad válida entre 18 y 99 años.");
            isValid = false;
        }

        // Validar Estado Civil
        if (!estadoCivilSelect.value) {
            showError("estado_civil", "Selecciona tu estado civil.");
            isValid = false;
        }

        // Validar Hijos
        if (!tieneHijosSelect.value) {
            showError("tiene_hijos", "Selecciona si tienes hijos.");
            isValid = false;
        }

        // Validar Profesión
        if (!profesionSelect.value) {
            showError("profesion", "Selecciona tu profesión.");
            isValid = false;
        }

        // Validar Capacidad Ahorro
        if (!ahorroSelect.value) {
            showError("ahorro", "Selecciona tu capacidad de ahorro mensual.");
            isValid = false;
        }

        // Validar Declaración
        if (!declaraSelect.value) {
            showError("declara", "Selecciona si declaras impuestos.");
            isValid = false;
        }

        // Validar Edad de Retiro
        const edadRetiroVal = parseInt(edadRetiroInput.value);
        if (isNaN(edadRetiroVal) || edadRetiroVal < 40 || edadRetiroVal > 85) {
            showError("edad_retiro", "Ingresa una edad de retiro de entre 40 y 85 años.");
            isValid = false;
        } else if (edadRetiroVal <= edadVal) {
            showError("edad_retiro", "La edad de retiro debe ser mayor a tu edad actual.");
            isValid = false;
        }

        // Validar Inversiones Actuales
        if (!invActualesSelect.value) {
            showError("inversiones_actuales", "Selecciona si tienes inversiones actualmente.");
            isValid = false;
        }

        // Validar Tipo de Inversionista
        if (!tipoInversionistaSelect.value) {
            showError("tipo_inversionista", "Selecciona tu perfil de inversionista.");
            isValid = false;
        }

        if (!isValid) return;

        // Recolectar seguros contratados
        const segurosMarcados = [];
        const segurosChecks = form.querySelectorAll("input[name='seguros']:checked");
        segurosChecks.forEach(ch => segurosMarcados.push(ch.value));

        // Recolectar dónde invierte
        const dondeInvierteMarcado = [];
        if (invActualesSelect.value === "Sí") {
            const invChecks = form.querySelectorAll("input[name='donde_invierte']:checked");
            invChecks.forEach(ch => dondeInvierteMarcado.push(ch.value));
        }

        // Guardar datos en el estado global
        state.lead.nombre = nombreInput.value.trim();
        state.lead.correo = correoVal;
        state.lead.whatsapp = whatsappVal;
        state.lead.edad = edadVal;
        state.lead.estado_civil = estadoCivilSelect.value;
        state.lead.tiene_hijos = tieneHijosSelect.value;
        state.lead.seguros = segurosMarcados;
        state.lead.profesion = profesionSelect.value;
        state.lead.capacidad_ahorro = ahorroSelect.value;
        state.lead.declara_impuestos = declaraSelect.value;
        state.lead.edad_retiro = edadRetiroVal;
        state.lead.inversiones_actuales = invActualesSelect.value;
        state.lead.donde_invierte = dondeInvierteMarcado;
        state.lead.tipo_inversionista = tipoInversionistaSelect.value;
        state.lead.comentarios = comentariosText.value.trim();

        // Mostrar carga
        btnContinuar.disabled = true;
        spinner.classList.remove("hidden");

        // LÓGICA CONDICIONAL DE AHORRO
        if (state.lead.capacidad_ahorro === "Menos de $2,000") {
            // Flujo No Calificado: Guardar de inmediato sin cita
            try {
                const response = await fetch(API_LEADS, {
                    method: "POST",
                    headers: { "Content-Type": "text/plain" },
                    body: JSON.stringify({
                        nombre: state.lead.nombre,
                        correo: state.lead.correo,
                        whatsapp: state.lead.whatsapp,
                        edad: state.lead.edad,
                        estado_civil: state.lead.estado_civil,
                        tiene_hijos: state.lead.tiene_hijos,
                        seguros: state.lead.seguros.join(", "),
                        profesion: state.lead.profesion,
                        capacidad_ahorro: state.lead.capacidad_ahorro,
                        declara_impuestos: state.lead.declara_impuestos,
                        edad_retiro: state.lead.edad_retiro,
                        inversiones_actuales: state.lead.inversiones_actuales,
                        donde_invierte: state.lead.donde_invierte.join(", "),
                        tipo_inversionista: state.lead.tipo_inversionista,
                        comentarios: state.lead.comentarios,
                        fecha_cita: null
                    })
                });

                if (!response.ok) throw new Error("Error en la conexión con el servidor.");
                const result = await response.json();
                if (result.status === "error" || result.error) {
                    throw new Error(result.error || "No se pudo registrar el lead.");
                }
                
                // Ocultar sección de calendario si está abierta
                document.getElementById("calendario-section").classList.add("hidden");

                // Mostrar Modal de agradecimiento
                openUnqualifiedModal();

            } catch (err) {
                console.error(err);
                alert("Hubo un problema al procesar tus datos. Por favor intenta de nuevo.");
            } finally {
                btnContinuar.disabled = false;
                spinner.classList.add("hidden");
            }

        } else {
            // Flujo Calificado: Cargar bloqueos de calendario y mostrar sección de agenda
            try {
                await fetchBlockedTimes();
                
                // Mostrar Sección C
                const calendarioSec = document.getElementById("calendario-section");
                calendarioSec.classList.remove("hidden");
                
                // Renderizar el Calendario Inicial
                renderCalendar();

                // Scroll suave a calendario
                setTimeout(() => {
                    calendarioSec.scrollIntoView({ behavior: "smooth" });
                }, 100);

            } catch (err) {
                console.error(err);
                alert("No se pudo cargar la agenda en este momento. Por favor, intenta más tarde.");
            } finally {
                btnContinuar.disabled = false;
                spinner.classList.add("hidden");
            }
        }
    });
}

function showError(fieldId, message) {
    const errorSpan = document.getElementById(`error-${fieldId}`);
    if (errorSpan) {
        errorSpan.textContent = message;
    }
}

function clearErrors() {
    const errorSpans = document.querySelectorAll(".error-msg");
    errorSpans.forEach(span => span.textContent = "");
}

/* ==========================================================================
   CARGA DE BLOQUEOS Y GESTIÓN DE CALENDARIO VIRTUAL
   ========================================================================== */
async function fetchBlockedTimes() {
    try {
        const response = await fetch(API_BLOQUEOS);
        if (!response.ok) throw new Error("Error al obtener bloqueos de base de datos.");
        const data = await response.json();
        
        // Mapear los strings de fecha bloqueada
        state.calendar.blockedTimes = data.map(item => item.fecha_hora_bloqueada);
    } catch (err) {
        console.error("Error cargando bloqueos:", err);
        state.calendar.blockedTimes = [];
    }
}

function initCalendarNav() {
    const prevBtn = document.getElementById("prev-month-btn");
    const nextBtn = document.getElementById("next-month-btn");

    prevBtn.addEventListener("click", () => {
        // Evitar ir antes de Mayo 2026
        if (state.calendar.currentYear === 2026 && state.calendar.currentMonth === 4) {
            return;
        }
        
        state.calendar.currentMonth--;
        if (state.calendar.currentMonth < 0) {
            state.calendar.currentMonth = 11;
            state.calendar.currentYear--;
        }
        renderCalendar();
        resetSlots();
    });

    nextBtn.addEventListener("click", () => {
        state.calendar.currentMonth++;
        if (state.calendar.currentMonth > 11) {
            state.calendar.currentMonth = 0;
            state.calendar.currentYear++;
        }
        renderCalendar();
        resetSlots();
    });
}

function renderCalendar() {
    const monthYearLabel = document.getElementById("current-month-year");
    const daysGrid = document.getElementById("calendar-days-grid");
    
    // Establecer cabecera
    monthYearLabel.textContent = `${MESES[state.calendar.currentMonth]} ${state.calendar.currentYear}`;
    daysGrid.innerHTML = "";

    // Navegación desactivada si es mes actual
    const prevBtn = document.getElementById("prev-month-btn");
    if (state.calendar.currentYear === 2026 && state.calendar.currentMonth === 4) {
        prevBtn.style.opacity = "0.2";
        prevBtn.style.pointerEvents = "none";
    } else {
        prevBtn.style.opacity = "1";
        prevBtn.style.pointerEvents = "auto";
    }

    const firstDay = new Date(state.calendar.currentYear, state.calendar.currentMonth, 1);
    const lastDay = new Date(state.calendar.currentYear, state.calendar.currentMonth, 0); // día anterior a mes actual
    
    // Obtener cuántos días tiene el mes actual
    const totalDays = new Date(state.calendar.currentYear, state.calendar.currentMonth + 1, 0).getDate();
    
    // Día de la semana del primer día (0=Dom, 1=Lun, ..., 6=Sáb)
    let startDayOfWeek = firstDay.getDay(); 
    // Ajustar para empezar en Lunes (0=Lun, 1=Mar, ..., 5=Sáb, 6=Dom)
    startDayOfWeek = (startDayOfWeek + 6) % 7;

    // Rellenar días del mes anterior vacíos
    for (let i = 0; i < startDayOfWeek; i++) {
        const cell = document.createElement("div");
        cell.className = "calendar-day-cell other-month";
        daysGrid.appendChild(cell);
    }

    // Dibujar días del mes
    for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
        const cell = document.createElement("div");
        cell.className = "calendar-day-cell";
        cell.textContent = dayNum;

        const loopDate = new Date(state.calendar.currentYear, state.calendar.currentMonth, dayNum);
        const dayOfWeek = loopDate.getDay(); // 0=Dom, 6=Sáb

        // 1. Excluir fines de semana (Sábado = 6, Domingo = 0)
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            cell.classList.add("weekend");
        }
        // 2. Excluir días en el pasado (Antes del 25 de Mayo de 2026)
        else if (loopDate < new Date(CURRENT_DATE_LIMIT.getFullYear(), CURRENT_DATE_LIMIT.getMonth(), CURRENT_DATE_LIMIT.getDate())) {
            cell.classList.add("past");
        }
        // Día válido seleccionable
        else {
            cell.classList.add("available");
            
            // Marcar si está seleccionado actualmente
            if (state.calendar.selectedDate && 
                state.calendar.selectedDate.getDate() === dayNum &&
                state.calendar.selectedDate.getMonth() === state.calendar.currentMonth &&
                state.calendar.selectedDate.getFullYear() === state.calendar.currentYear) {
                cell.classList.add("selected");
            }

            // Añadir evento clic al día
            cell.addEventListener("click", () => {
                // Remover selección previa
                const selectedCell = daysGrid.querySelector(".calendar-day-cell.selected");
                if (selectedCell) selectedCell.classList.remove("selected");

                // Añadir selección actual
                cell.classList.add("selected");
                state.calendar.selectedDate = new Date(state.calendar.currentYear, state.calendar.currentMonth, dayNum);
                
                // Renderizar los slots para este día
                renderSlotsForDay(state.calendar.selectedDate);
            });
        }

        daysGrid.appendChild(cell);
    }
}

function resetSlots() {
    const slotsContainer = document.getElementById("slots-container");
    const dayLabel = document.getElementById("selected-day-label");
    const btnAgendar = document.getElementById("btn-agendar");
    
    dayLabel.textContent = "...";
    slotsContainer.innerHTML = `
        <div class="slots-placeholder">
            Selecciona un día hábil en el calendario para ver los horarios de 45 minutos disponibles.
        </div>
    `;
    btnAgendar.disabled = true;
    state.calendar.selectedSlot = null;
}

/* ==========================================================================
   RENDER DE SLOTS DE TIEMPO
   ========================================================================== */
function renderSlotsForDay(dateObj) {
    const slotsContainer = document.getElementById("slots-container");
    const dayLabel = document.getElementById("selected-day-label");
    let btnAgendar = document.getElementById("btn-agendar");
    
    // Clonamos primero para evitar fugas de eventos y actualizar el nodo en el DOM
    const btnClon = btnAgendar.cloneNode(true);
    btnAgendar.parentNode.replaceChild(btnClon, btnAgendar);
    btnAgendar = btnClon;

    btnAgendar.disabled = true;
    state.calendar.selectedSlot = null;

    // Formatear etiqueta de día, ej: "Jueves 28 de Mayo"
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    const dateFormatted = dateObj.toLocaleDateString('es-ES', options);
    dayLabel.textContent = dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1);

    slotsContainer.innerHTML = "";

    // Obtener formato YYYY-MM-DD para cruzar
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const datePrefix = `${year}-${month}-${day}`;

    // Añadir listener de agenda
    btnAgendar.addEventListener("click", () => {
        confirmarAgenda(datePrefix, state.calendar.selectedSlot);
    });

    // Renderizar slots
    TIME_SLOTS.forEach(time => {
        const slotBtn = document.createElement("button");
        slotBtn.type = "button";
        slotBtn.className = "slot-btn";
        
        // Dar formato visual de AM/PM
        const [hourStr, minStr] = time.split(":");
        const hourInt = parseInt(hourStr);
        const ampm = hourInt >= 12 ? "PM" : "AM";
        const displayHour = hourInt > 12 ? hourInt - 12 : hourInt;
        slotBtn.textContent = `${String(displayHour).padStart(2, '0')}:${minStr} ${ampm}`;

        const fullDateTime = `${datePrefix}T${time}:00`;

        // Validar si el slot está bloqueado en base de datos
        // Hacemos una comparación parcial o exacta con los strings ISO
        const isOccupied = state.calendar.blockedTimes.some(block => block.startsWith(fullDateTime) || fullDateTime.startsWith(block));

        if (isOccupied) {
            slotBtn.classList.add("occupied");
            slotBtn.disabled = true;
        } else {
            // Evento de clic en slot
            slotBtn.addEventListener("click", () => {
                const activeSelected = slotsContainer.querySelector(".slot-btn.selected");
                if (activeSelected) activeSelected.classList.remove("selected");

                slotBtn.classList.add("selected");
                state.calendar.selectedSlot = time;

                // Habilitar botón de agendar
                btnAgendar.disabled = false;
            });
        }

        slotsContainer.appendChild(slotBtn);
    });
}

/* ==========================================================================
   PROCESAMIENTO DE RESERVA Y AUTOMATIZACIÓN DE CIERRE
   ========================================================================== */
async function confirmarAgenda(dateStr, timeStr) {
    const btnAgendar = document.getElementById("btn-agendar");
    const spinner = document.getElementById("agenda-spinner");
    const btnText = btnAgendar.querySelector(".btn-text");

    btnAgendar.disabled = true;
    spinner.classList.remove("hidden");
    if (btnText) btnText.textContent = "Procesando...";

    // Combinar en ISO
    const fechaHoraCita = `${dateStr}T${timeStr}:00`;

    try {
        const response = await fetch(API_LEADS, {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify({
                nombre: state.lead.nombre,
                correo: state.lead.correo,
                whatsapp: state.lead.whatsapp,
                edad: state.lead.edad,
                estado_civil: state.lead.estado_civil,
                tiene_hijos: state.lead.tiene_hijos,
                seguros: state.lead.seguros.join(", "),
                profesion: state.lead.profesion,
                capacidad_ahorro: state.lead.capacidad_ahorro,
                declara_impuestos: state.lead.declara_impuestos,
                edad_retiro: state.lead.edad_retiro,
                inversiones_actuales: state.lead.inversiones_actuales,
                donde_invierte: state.lead.donde_invierte.join(", "),
                tipo_inversionista: state.lead.tipo_inversionista,
                comentarios: state.lead.comentarios,
                fecha_cita: fechaHoraCita
            })
        });

        if (!response.ok) {
            throw new Error("Error en la conexión con el servidor de la nube.");
        }

        const savedLead = await response.json();
        if (savedLead.status === "error" || savedLead.error) {
            throw new Error(savedLead.error || "No se pudo agendar la cita.");
        }

        // Construir el objeto lead completo para la pantalla de éxito
        const completedLead = {
            ...state.lead,
            fecha_cita: fechaHoraCita,
            estatus: "Agendada"
        };

        // Actualizar bloqueos locales
        await fetchBlockedTimes();

        // Mostrar pantalla de éxito
        mostrarExito(completedLead);

    } catch (err) {
        console.error(err);
        alert(err.message || "Ocurrió un error al agendar tu cita. Por favor, selecciona otro horario o intenta de nuevo.");
        spinner.classList.add("hidden");
        if (btnText) btnText.textContent = "Confirmar y Agendar Asesoría";
        btnAgendar.disabled = false;
    }
}

function mostrarExito(lead) {
    // Ocultar landing, cuestionario y calendario
    document.getElementById("hero").classList.add("hidden");
    document.getElementById("cuestionario").classList.add("hidden");
    document.getElementById("calendario-section").classList.add("hidden");
    document.getElementById("main-header").classList.add("hidden");

    // Mostrar sección éxito
    const successScreen = document.getElementById("success-screen");
    successScreen.classList.remove("hidden");

    // Formatear fecha para el resumen en español
    const dateObj = new Date(lead.fecha_cita);
    const diaOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const diaFormatted = dateObj.toLocaleDateString('es-MX', diaOptions);
    const formattedDateString = diaFormatted.charAt(0).toUpperCase() + diaFormatted.slice(1);

    const [hourStr, minStr] = lead.fecha_cita.split("T")[1].split(":");
    const hourInt = parseInt(hourStr);
    const ampm = hourInt >= 12 ? "PM" : "AM";
    const displayHour = hourInt > 12 ? hourInt - 12 : hourInt;
    const formattedTimeString = `${String(displayHour).padStart(2, '0')}:${minStr} ${ampm}`;

    // Dibujar el resumen
    const summaryContainer = document.getElementById("appointment-summary");
    summaryContainer.innerHTML = `
        <div class="summary-row">
            <span class="summary-label">Asesorado:</span>
            <span class="summary-value">${lead.nombre}</span>
        </div>
        <div class="summary-row">
            <span class="summary-label">Correo:</span>
            <span class="summary-value">${lead.correo}</span>
        </div>
        <div class="summary-row">
            <span class="summary-label">WhatsApp:</span>
            <span class="summary-value">+52 ${lead.whatsapp}</span>
        </div>
        <div class="summary-row">
            <span class="summary-label">Edad / Estado Civil:</span>
            <span class="summary-value">${lead.edad} años (${lead.estado_civil})</span>
        </div>
        <div class="summary-row">
            <span class="summary-label">¿Tiene Hijos?:</span>
            <span class="summary-value">${lead.tiene_hijos}</span>
        </div>
        <div class="summary-row">
            <span class="summary-label">Seguros Actuales:</span>
            <span class="summary-value">${lead.seguros.length > 0 ? lead.seguros.join(", ") : "Ninguno"}</span>
        </div>
        <div class="summary-row">
            <span class="summary-label">Perfil Profesional:</span>
            <span class="summary-value">${lead.profesion}</span>
        </div>
        <div class="summary-row">
            <span class="summary-label">Ahorro Mensual:</span>
            <span class="summary-value highlight">${lead.capacidad_ahorro}</span>
        </div>
        <div class="summary-row">
            <span class="summary-label">Edad Retiro Deseada:</span>
            <span class="summary-value highlight">${lead.edad_retiro} años</span>
        </div>
        <div class="summary-row">
            <span class="summary-label">Inversiones Actuales:</span>
            <span class="summary-value">${lead.inversiones_actuales === "Sí" ? `Sí (${lead.donde_invierte.join(", ")})` : "No"}</span>
        </div>
        <div class="summary-row">
            <span class="summary-label">Perfil Temeridad:</span>
            <span class="summary-value">${lead.tipo_inversionista}</span>
        </div>
        ${lead.comentarios ? `
        <div class="summary-row" style="grid-column: 1 / -1;">
            <span class="summary-label">Notas Adicionales:</span>
            <span class="summary-value" style="font-style: italic;">"${lead.comentarios}"</span>
        </div>` : ''}
        <div class="summary-row">
            <span class="summary-label">Fecha de la Cita:</span>
            <span class="summary-value highlight">${formattedDateString}</span>
        </div>
        <div class="summary-row">
            <span class="summary-label">Horario:</span>
            <span class="summary-value highlight">${formattedTimeString} (Hora Centro)</span>
        </div>
        <div class="summary-row">
            <span class="summary-label">Estatus de Reserva:</span>
            <span class="summary-value highlight" style="color: var(--whatsapp-green);">${lead.estatus}</span>
        </div>
    `;

    // Configurar redirección de WhatsApp
    const waBtn = document.getElementById("whatsapp-confirm-btn");
    const waNumber = "528123246698"; // Código de país +52 + 81 2324 6698
    const waText = `Hola! Acabo de agendar mi asesoría para mi Estrategia de Retiro Plus con Finanzas con K 🪙. Mi nombre es ${lead.nombre}.`;
    const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(waText)}`;
    waBtn.href = waUrl;

    // Configurar redirección de Google Calendar para el Cliente
    const gcBtn = document.getElementById("google-calendar-btn");
    const startTime = new Date(lead.fecha_cita);
    const endTime = new Date(startTime.getTime() + 45 * 60 * 1000); // 45 minutos

    const formatToUTC = (date) => {
        return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    };

    const startUTC = formatToUTC(startTime);
    const endUTC = formatToUTC(endTime);

    const eventTitle = "Estrategia de Retiro Plus (Finanzas con K 📈)";
    const eventDetails = `Hola ${lead.nombre},\n\nTu sesión de asesoría financiera para diseñar tu Estrategia de Retiro Plus respaldada por Allianz está confirmada.\n\nResumen del Diagnóstico:\n- Edad: ${lead.edad} años\n- Estado Civil: ${lead.estado_civil} (Hijos: ${lead.tiene_hijos})\n- Ahorro Mensual: ${lead.capacidad_ahorro}\n- Edad de Retiro Deseada: ${lead.edad_retiro} años\n- Perfil de Riesgo: ${lead.tipo_inversionista}\n\nNos conectaremos para modelar tus proyecciones en portafolios del S&P 500 y Nasdaq.\n\nPor favor confirma en el chat de WhatsApp (+52 81 2324 6698) para recibir el enlace directo de Zoom/Meet para la sesión.`;
    const eventLocation = "Sesión Online (Zoom/Meet)";

    const gcUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventTitle)}&dates=${startUTC}/${endUTC}&details=${encodeURIComponent(eventDetails)}&location=${encodeURIComponent(eventLocation)}`;
    gcBtn.href = gcUrl;

    // Scroll suave a éxito
    successScreen.scrollIntoView({ behavior: "smooth" });
}

/* ==========================================================================
   MODAL DE EXCLUSIÓN
   ========================================================================== */
function initModal() {
    const modal = document.getElementById("modal-unqualified");
    const closeBtn = document.getElementById("modal-close-btn");
    const okBtn = document.getElementById("modal-ok-btn");

    const closeModal = () => {
        modal.classList.add("hidden");
        // Reiniciar formulario
        document.getElementById("lead-form").reset();
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (okBtn) okBtn.addEventListener("click", closeModal);
    
    // Cerrar al dar clic fuera de la tarjeta
    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
}

function openUnqualifiedModal() {
    const modal = document.getElementById("modal-unqualified");
    modal.classList.remove("hidden");
}
