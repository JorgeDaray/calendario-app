const supabaseUrl = 'https://gunnbobibgwztjaeaafi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1bm5ib2JpYmd3enRqYWVhYWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxODM5NTIsImV4cCI6MjEwMDc1OTk1Mn0.gSqChQVOShjT8oLILid_2VQreKjRvsc-cDbzGGzMQkY';
const clienteSupabase = supabase.createClient(supabaseUrl, supabaseKey);

let usuarioActualId = null;
let calendar; 
let fechaSeleccionada = null; 
let eventoSeleccionadoId = null; 

document.addEventListener('DOMContentLoaded', async function() {
    const loginContainer = document.getElementById('login-container');
    const appContainer = document.getElementById('app-container');
    const btnLogin = document.getElementById('btnLogin');
    const btnLogout = document.getElementById('btnLogout');
    const loginError = document.getElementById('loginError');

    const { data: { session } } = await clienteSupabase.auth.getSession();
    if (session) iniciarApp(session.user.id);

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
            
            events: async function(info, successCallback, failureCallback) {
                const [resDisp, resEventos] = await Promise.all([
                    clienteSupabase.from('disponibilidad').select('*'),
                    clienteSupabase.from('eventos').select('*')
                ]);

                if (resDisp.error || resEventos.error) {
                    failureCallback(resDisp.error || resEventos.error); return;
                }

                const eventosVisuales = [];
                
                resDisp.data.forEach(reg => {
                    if (reg.estado === 'disponible') eventosVisuales.push({ title: 'Disponible', start: reg.fecha, color: '#28a745', allDay: true, display: 'background' });
                    else if (reg.estado === 'probable') eventosVisuales.push({ title: 'Probable', start: reg.fecha, color: '#ffc107', allDay: true, display: 'background' });
                });

                resEventos.data.forEach(evt => {
                    eventosVisuales.push({
                        id: evt.id,
                        title: '🎉 ' + evt.titulo,
                        start: evt.fecha_hora,
                        color: '#6f42c1', 
                        extendedProps: { 
                            esOficial: true,
                            descripcion: evt.descripcion,
                            ubicacion: evt.ubicacion // Pasamos la ubicación al calendario
                        }
                    });
                });

                successCallback(eventosVisuales);
            },
            
            dateClick: function(info) {
                fechaSeleccionada = info.dateStr;
                document.getElementById('modalFechaTexto').innerText = "Estado para: " + info.dateStr;
                document.getElementById('modalDisponibilidad').className = 'modal-visible';
            },

            // AL HACER CLIC EN UN EVENTO YA CREADO
            eventClick: async function(info) {
                if (info.event.extendedProps.esOficial) {
                    const evt = info.event;
                    eventoSeleccionadoId = evt.id;
                    
                    // 1. Llenar textos del modal
                    document.getElementById('modalRSVPTitulo').innerText = evt.title;
                    document.getElementById('rsvpFechaHora').innerText = evt.start.toLocaleString();
                    document.getElementById('rsvpUbicacion').innerText = evt.extendedProps.ubicacion || 'Sin ubicación definida';
                    document.getElementById('rsvpDescripcion').innerText = evt.extendedProps.descripcion || 'Sin descripción';

                    // 2. Generar Link de Google Calendar
                    const formatLocal = (d) => {
                        const pad = (n) => n < 10 ? '0'+n : n;
                        return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
                    };
                    const fechaInicio = evt.start;
                    const fechaFin = new Date(fechaInicio.getTime() + 2 * 60 * 60 * 1000); // Suma 2 horas por defecto
                    const tituloGcal = evt.title.replace('🎉 ', '');
                    
                    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(tituloGcal)}&dates=${formatLocal(fechaInicio)}/${formatLocal(fechaFin)}&details=${encodeURIComponent(evt.extendedProps.descripcion || '')}&location=${encodeURIComponent(evt.extendedProps.ubicacion || '')}`;
                    document.getElementById('btnGoogleCalendar').href = gcalUrl;

                    // 3. Obtener lista de asistentes desde Supabase (Cruzando tablas)
                    document.getElementById('listaAsistentes').innerHTML = '<li>Cargando asistentes...</li>';
                    
                    const { data: asistentes, error } = await clienteSupabase
                        .from('asistencia_eventos')
                        .select('estado, perfiles(nombre)')
                        .eq('evento_id', eventoSeleccionadoId);

                    const listaHtml = document.getElementById('listaAsistentes');
                    listaHtml.innerHTML = '';
                    
                    if (!error && asistentes.length > 0) {
                        asistentes.forEach(asistencia => {
                            let icono = asistencia.estado === 'asistire' ? '✅' : (asistencia.estado === 'en_espera' ? '⏳' : '❌');
                            const li = document.createElement('li');
                            li.innerText = `${icono} ${asistencia.perfiles.nombre}`;
                            listaHtml.appendChild(li);
                        });
                    } else {
                        listaHtml.innerHTML = '<li style="color: #6c757d;">Nadie ha confirmado aún.</li>';
                    }

                    // Mostrar modal
                    document.getElementById('modalRSVP').className = 'modal-visible';
                }
            }
        });
        calendar.render();
    }

    const cerrarModalDisp = () => document.getElementById('modalDisponibilidad').className = 'modal-oculto';
    const cerrarModalCrear = () => document.getElementById('modalCrearEvento').className = 'modal-oculto';
    const cerrarModalRSVP = () => document.getElementById('modalRSVP').className = 'modal-oculto';

    async function guardarEstado(estado) {
        if (!fechaSeleccionada || !usuarioActualId) return;
        const { error } = await clienteSupabase.from('disponibilidad').upsert(
            { fecha: fechaSeleccionada, usuario_id: usuarioActualId, estado: estado }, 
            { onConflict: 'fecha,usuario_id' }
        );
        if (!error) { calendar.refetchEvents(); actualizarPanelMejoresDias(); }
        cerrarModalDisp(); 
    }

    // AL GUARDAR EVENTO NUEVO
    async function guardarEvento() {
        const titulo = document.getElementById('inputTituloEvento').value;
        const hora = document.getElementById('inputHoraEvento').value;
        const ubicacion = document.getElementById('inputUbicacionEvento').value;
        const desc = document.getElementById('inputDescEvento').value;

        if(!titulo || !hora) return alert("Falta título u hora");
        const fechaHoraTimestamp = `${fechaSeleccionada}T${hora}:00`;

        const { error } = await clienteSupabase.from('eventos').insert({
            titulo: titulo,
            descripcion: desc,
            ubicacion: ubicacion, // Se envía a la base de datos
            fecha_hora: fechaHoraTimestamp,
            creado_por: usuarioActualId
        });

        if (error) alert("Error creando evento.");
        else calendar.refetchEvents();
        
        cerrarModalCrear();
    }

    async function guardarRSVP(estado) {
        if(!eventoSeleccionadoId || !usuarioActualId) return;
        
        const { error } = await clienteSupabase.from('asistencia_eventos').upsert(
            { evento_id: eventoSeleccionadoId, usuario_id: usuarioActualId, estado: estado },
            { onConflict: 'evento_id,usuario_id' }
        );

        if(error) alert("Error guardando tu asistencia.");
        
        // Recargar modal para ver tu propio nombre en la lista al instante
        cerrarModalRSVP();
        calendar.refetchEvents(); 
    }

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
            li.innerHTML = `
                <span>#${index + 1} - ${dia.fecha} <span class="puntos-badge">${dia.puntos} pts</span></span> 
                <button class="btn-armar" data-fecha="${dia.fecha}">Crear Evento</button>
            `;
            listaHtml.appendChild(li);
        });

        document.querySelectorAll('.btn-armar').forEach(btn => {
            btn.addEventListener('click', (e) => {
                fechaSeleccionada = e.target.getAttribute('data-fecha');
                document.getElementById('textoFechaEvento').innerText = `Para el día: ${fechaSeleccionada}`;
                document.getElementById('modalCrearEvento').className = 'modal-visible';
            });
        });
    }

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