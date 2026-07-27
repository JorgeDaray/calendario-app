const supabaseUrl = 'https://gunnbobibgwztjaeaafi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1bm5ib2JpYmd3enRqYWVhYWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxODM5NTIsImV4cCI6MjEwMDc1OTk1Mn0.gSqChQVOShjT8oLILid_2VQreKjRvsc-cDbzGGzMQkY';
const clienteSupabase = supabase.createClient(supabaseUrl, supabaseKey);

let usuarioActualId = null;
let calendar; 
let fechaSeleccionada = null; 
let eventoSeleccionadoId = null; // Para guardar a qué evento le dimos clic

document.addEventListener('DOMContentLoaded', async function() {
    const loginContainer = document.getElementById('login-container');
    const appContainer = document.getElementById('app-container');
    const btnLogin = document.getElementById('btnLogin');
    const btnLogout = document.getElementById('btnLogout');
    const loginError = document.getElementById('loginError');

    // 1. REVISAR SESIÓN
    const { data: { session } } = await clienteSupabase.auth.getSession();
    if (session) iniciarApp(session.user.id);

    // 2. LOGIN Y LOGOUT
    btnLogin.addEventListener('click', async () => {
        const email = document.getElementById('emailInput').value;
        const password = document.getElementById('passwordInput').value;
        btnLogin.innerText = 'Cargando...';
        const { data, error } = await clienteSupabase.auth.signInWithPassword({ email, password });

        if (error) {
            loginError.innerText = "Correo o contraseña incorrectos.";
            loginError.classList.remove('oculto');
            btnLogin.innerText = 'Entrar';
        } else {
            loginError.classList.add('oculto');
            iniciarApp(data.user.id);
        }
    });

    btnLogout.addEventListener('click', async () => {
        await clienteSupabase.auth.signOut();
        window.location.reload(); 
    });

    // 3. INICIO DE APP Y CALENDARIO
    function iniciarApp(userId) {
        usuarioActualId = userId;
        loginContainer.classList.add('oculto');
        appContainer.classList.remove('oculto');
        renderizarCalendario();
        actualizarPanelMejoresDias();
    }

    function renderizarCalendario() {
        var calendarEl = document.getElementById('calendar');
        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,dayGridWeek,dayGridDay' },
            
            // AHORA LEEMOS DE 2 TABLAS (Disponibilidad y Eventos)
            events: async function(info, successCallback, failureCallback) {
                const [resDisp, resEventos] = await Promise.all([
                    clienteSupabase.from('disponibilidad').select('*'),
                    clienteSupabase.from('eventos').select('*')
                ]);

                if (resDisp.error || resEventos.error) {
                    console.error("Error cargando datos");
                    failureCallback(resDisp.error || resEventos.error); return;
                }

                const eventosVisuales = [];
                
                // Pintar disponibilidad (Fondo verde/amarillo)
                resDisp.data.forEach(reg => {
                    if (reg.estado === 'disponible') eventosVisuales.push({ title: 'Disponible', start: reg.fecha, color: '#28a745', allDay: true, display: 'background' });
                    else if (reg.estado === 'probable') eventosVisuales.push({ title: 'Probable', start: reg.fecha, color: '#ffc107', allDay: true, display: 'background' });
                });

                // Pintar Eventos Oficiales (Globos morados)
                resEventos.data.forEach(evt => {
                    eventosVisuales.push({
                        id: evt.id, // ID real de la base de datos
                        title: '🎉 ' + evt.titulo,
                        start: evt.fecha_hora,
                        color: '#6f42c1', 
                        extendedProps: { esOficial: true } // Marca para saber que es un evento
                    });
                });

                successCallback(eventosVisuales);
            },
            
            // CLIC EN UN DÍA VACÍO (Disponibilidad)
            dateClick: function(info) {
                fechaSeleccionada = info.dateStr;
                document.getElementById('modalFechaTexto').innerText = "Estado para: " + info.dateStr;
                document.getElementById('modalDisponibilidad').className = 'modal-visible';
            },

            // CLIC EN UN EVENTO YA CREADO (RSVP)
            eventClick: function(info) {
                if (info.event.extendedProps.esOficial) {
                    eventoSeleccionadoId = info.event.id;
                    document.getElementById('modalRSVPTitulo').innerText = info.event.title;
                    document.getElementById('modalRSVP').className = 'modal-visible';
                }
            }
        });
        calendar.render();
    }

    // --- FUNCIONES DE MODALES Y BASE DE DATOS ---
    
    // Cerrar modales
    const cerrarModalDisp = () => document.getElementById('modalDisponibilidad').className = 'modal-oculto';
    const cerrarModalCrear = () => document.getElementById('modalCrearEvento').className = 'modal-oculto';
    const cerrarModalRSVP = () => document.getElementById('modalRSVP').className = 'modal-oculto';

    // Guardar Disponibilidad (Igual que antes)
    async function guardarEstado(estado) {
        if (!fechaSeleccionada || !usuarioActualId) return;
        const { error } = await clienteSupabase.from('disponibilidad').upsert(
            { fecha: fechaSeleccionada, usuario_id: usuarioActualId, estado: estado }, 
            { onConflict: 'fecha,usuario_id' }
        );
        if (!error) { calendar.refetchEvents(); actualizarPanelMejoresDias(); }
        cerrarModalDisp(); 
    }

    // Guardar Evento Oficial
    async function guardarEvento() {
        const titulo = document.getElementById('inputTituloEvento').value;
        const hora = document.getElementById('inputHoraEvento').value;
        const desc = document.getElementById('inputDescEvento').value;

        if(!titulo || !hora) return alert("Falta título u hora");

        // Unimos la fecha seleccionada con la hora para el campo TIMESTAMP
        const fechaHoraTimestamp = `${fechaSeleccionada}T${hora}:00`;

        const { error } = await clienteSupabase.from('eventos').insert({
            titulo: titulo,
            descripcion: desc,
            fecha_hora: fechaHoraTimestamp,
            creado_por: usuarioActualId
        });

        if (error) alert("Error creando evento.");
        else calendar.refetchEvents();
        
        cerrarModalCrear();
    }

    // Guardar Asistencia (RSVP)
    async function guardarRSVP(estado) {
        if(!eventoSeleccionadoId || !usuarioActualId) return;
        
        const { error } = await clienteSupabase.from('asistencia_eventos').upsert(
            { evento_id: eventoSeleccionadoId, usuario_id: usuarioActualId, estado: estado },
            { onConflict: 'evento_id,usuario_id' }
        );

        if(error) alert("Error guardando tu asistencia.");
        else alert("¡Asistencia guardada!");
        
        cerrarModalRSVP();
    }

    // Actualizar Panel de Mejores Días (Ahora inyecta botones)
    async function actualizarPanelMejoresDias() {
        const { data, error } = await clienteSupabase.from('disponibilidad').select('*');
        if (error) return;

        const puntuacion = {};
        data.forEach(reg => {
            if (!puntuacion[reg.fecha]) puntuacion[reg.fecha] = 0;
            if (reg.estado === 'disponible') puntuacion[reg.fecha] += 2;
            else if (reg.estado === 'probable') puntuacion[reg.fecha] += 1;
        });

        const top3 = Object.keys(puntuacion)
            .map(fecha => ({ fecha, puntos: puntuacion[fecha] }))
            .filter(dia => dia.puntos > 0)
            .sort((a, b) => b.puntos - a.puntos)
            .slice(0, 3);
            
        const listaHtml = document.getElementById('listaMejoresDias');
        listaHtml.innerHTML = ''; 
        if (top3.length === 0) {
            listaHtml.innerHTML = '<li style="text-align:center; color:#6c757d;">Sin datos aún.</li>'; return;
        }

        top3.forEach((dia, index) => {
            const li = document.createElement('li');
            li.className = 'dia-top';
            // Inyectamos el botón con un dataset para saber qué fecha crear
            li.innerHTML = `
                <span>#${index + 1} - ${dia.fecha} <span class="puntos-badge">${dia.puntos} pts</span></span> 
                <button class="btn-armar" data-fecha="${dia.fecha}">Crear Evento</button>
            `;
            listaHtml.appendChild(li);
        });

        // Escuchar clics en los nuevos botones "Crear Evento"
        document.querySelectorAll('.btn-armar').forEach(btn => {
            btn.addEventListener('click', (e) => {
                fechaSeleccionada = e.target.getAttribute('data-fecha');
                document.getElementById('textoFechaEvento').innerText = `Para el día: ${fechaSeleccionada}`;
                document.getElementById('modalCrearEvento').className = 'modal-visible';
            });
        });
    }

    // CONECTAR BOTONES DE MODALES
    document.getElementById('btnDisponible').addEventListener('click', () => guardarEstado('disponible'));
    document.getElementById('btnProbable').addEventListener('click', () => guardarEstado('probable'));
    document.getElementById('btnLimpiar').addEventListener('click', () => guardarEstado('no_definido'));
    document.getElementById('btnCerrar').addEventListener('click', cerrarModalDisp);
    
    document.getElementById('btnGuardarEvento').addEventListener('click', guardarEvento);
    document.getElementById('btnCerrarCrearEvento').addEventListener('click', cerrarModalCrear);

    document.getElementById('btnRSVPAsistire').addEventListener('click', () => guardarRSVP('asistire'));
    document.getElementById('btnRSVPEnEspera').addEventListener('click', () => guardarRSVP('en_espera'));
    document.getElementById('btnRSVPNoAsistire').addEventListener('click', () => guardarRSVP('no_asistire'));
    document.getElementById('btnCerrarRSVP').addEventListener('click', cerrarModalRSVP);
});