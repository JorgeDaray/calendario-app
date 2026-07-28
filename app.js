const supabaseUrl = 'https://gunnbobibgwztjaeaafi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1bm5ib2JpYmd3enRqYWVhYWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxODM5NTIsImV4cCI6MjEwMDc1OTk1Mn0.gSqChQVOShjT8oLILid_2VQreKjRvsc-cDbzGGzMQkY';
const clienteSupabase = supabase.createClient(supabaseUrl, supabaseKey);

let usuarioActualId = null;
let calendar; 
let fechaSeleccionada = null; 
let eventoSeleccionadoId = null; 
let mostrarTodosLosDias = false; // NUEVO: Controla la expansión de la lista

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

    async function iniciarApp(userId) {
        usuarioActualId = userId;
        loginContainer.classList.add('oculto');
        appContainer.classList.remove('oculto');
        
        const { data: perfil } = await clienteSupabase.from('perfiles').select('nombre').eq('id', userId).single();
        if (perfil) {
            document.getElementById('nombreUsuarioHeader').innerText = perfil.nombre;
        }

        renderizarCalendario();
        actualizarPanelMejoresDias();
        iniciarSincronizacionEnVivo(); 
    }

    document.getElementById('btnIrAFecha').addEventListener('click', () => {
        const fecha = document.getElementById('inputBuscarFecha').value;
        if (fecha && calendar) calendar.gotoDate(fecha);
    });

    document.getElementById('chkVerDisponibles').addEventListener('change', () => calendar.refetchEvents());
    document.getElementById('chkVerEventos').addEventListener('change', () => calendar.refetchEvents());

    function renderizarCalendario() {
        var calendarEl = document.getElementById('calendar');
        calendar = new FullCalendar.Calendar(calendarEl, {
            locale: 'es', 
            buttonText: {
                today: 'Hoy',
                month: 'Mes',
                week: 'Semana',
                day: 'Día',
                year: 'Año',
                list: 'Agenda' // Botón para la vista de lista
            },
            initialView: 'dayGridMonth',
            dayMaxEvents: 10, // Límite de bloques visibles en un solo día en la cuadrícula
            // Se agregó listMonth a la barra para ver solo los días con datos
            headerToolbar: { left: 'prev,next today', center: 'title', right: 'listMonth,multiMonthYear,dayGridMonth,dayGridWeek' },
            
            events: async function(info, successCallback, failureCallback) {
                try {
                    const verDisp = document.getElementById('chkVerDisponibles').checked;
                    const verEventos = document.getElementById('chkVerEventos').checked;
                    const eventosVisuales = [];

                    if (verDisp) {
                        const { data: dataDisp, error: errDisp } = await clienteSupabase.from('disponibilidad').select('*');
                        if (errDisp) throw errDisp;
                        
                        dataDisp.forEach(reg => {
                            if (reg.estado === 'disponible') eventosVisuales.push({ title: 'Disponible', start: reg.fecha, color: '#28a745', allDay: true, display: 'background' });
                            else if (reg.estado === 'probable') eventosVisuales.push({ title: 'Probable', start: reg.fecha, color: '#ffc107', allDay: true, display: 'background' });
                        });
                    }

                    if (verEventos) {
                        const { data: dataEvt, error: errEvt } = await clienteSupabase.from('eventos').select('*');
                        if (errEvt) throw errEvt;

                        dataEvt.forEach(evt => {
                            eventosVisuales.push({
                                id: evt.id,
                                title: '🎉 ' + evt.titulo,
                                start: evt.fecha_hora,
                                color: '#6f42c1', 
                                extendedProps: { 
                                    esOficial: true,
                                    descripcion: evt.descripcion,
                                    ubicacion: evt.ubicacion,
                                    creado_por: evt.creado_por
                                }
                            });
                        });
                    }

                    successCallback(eventosVisuales);

                } catch (error) {
                    console.error("Error al filtrar datos:", error);
                    failureCallback(error);
                }
            },
            
            dateClick: function(info) {
                fechaSeleccionada = info.dateStr;
                document.getElementById('modalFechaTexto').innerText = "Estado para: " + info.dateStr;
                document.getElementById('modalDisponibilidad').className = 'modal-visible';
            },

            eventClick: async function(info) {
                if (info.event.extendedProps.esOficial) {
                    const evt = info.event;
                    eventoSeleccionadoId = evt.id;
                    
                    document.getElementById('modalRSVPTitulo').innerText = evt.title;
                    document.getElementById('rsvpFechaHora').innerText = evt.start.toLocaleString();
                    document.getElementById('rsvpUbicacion').innerText = evt.extendedProps.ubicacion || 'Sin ubicación definida';
                    document.getElementById('rsvpDescripcion').innerText = evt.extendedProps.descripcion || 'Sin descripción';

                    const formatLocal = (d) => {
                        const pad = (n) => n < 10 ? '0'+n : n;
                        return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
                    };
                    const fechaInicio = evt.start;
                    const fechaFin = new Date(fechaInicio.getTime() + 2 * 60 * 60 * 1000); 
                    const tituloGcal = evt.title.replace('🎉 ', '');
                    
                    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(tituloGcal)}&dates=${formatLocal(fechaInicio)}/${formatLocal(fechaFin)}&details=${encodeURIComponent(evt.extendedProps.descripcion || '')}&location=${encodeURIComponent(evt.extendedProps.ubicacion || '')}`;
                    document.getElementById('btnGoogleCalendar').href = gcalUrl;

                    document.getElementById('listaAsistentes').innerHTML = '<li>Cargando asistentes...</li>';
                    
                    const { data: asistentes, error } = await clienteSupabase
                        .from('asistencia_eventos')
                        .select('usuario_id, estado, perfiles(nombre)')
                        .eq('evento_id', eventoSeleccionadoId);

                    const listaHtml = document.getElementById('listaAsistentes');
                    listaHtml.innerHTML = '';
                    
                    let otrosAsistentesConfirmados = 0; 

                    if (!error && asistentes.length > 0) {
                        asistentes.forEach(asistencia => {
                            let icono = asistencia.estado === 'asistire' ? '✅' : (asistencia.estado === 'en_espera' ? '⏳' : '❌');
                            const li = document.createElement('li');
                            li.innerText = `${icono} ${asistencia.perfiles.nombre}`;
                            listaHtml.appendChild(li);

                            if (asistencia.estado === 'asistire' && asistencia.usuario_id !== usuarioActualId) {
                                otrosAsistentesConfirmados++;
                            }
                        });
                    } else {
                        listaHtml.innerHTML = '<li style="color: #6c757d;">Nadie ha confirmado aún.</li>';
                    }

                    const controlesCreador = document.getElementById('controlesCreador');
                    const btnEliminar = document.getElementById('btnEliminarEvento');

                    if (evt.extendedProps.creado_por === usuarioActualId) {
                        controlesCreador.classList.remove('oculto');
                        
                        btnEliminar.onclick = async () => {
                            if (otrosAsistentesConfirmados > 0) {
                                alert("⚠️ No puedes eliminar el evento porque ya hay personas confirmadas. Si no puedes asistir, simplemente cambia tu estado a 'No Asistiré' para que los demás mantengan el plan.");
                                return;
                            }
                            
                            if (confirm("¿Estás seguro de que quieres cancelar y borrar este evento?")) {
                                await clienteSupabase.from('asistencia_eventos').delete().eq('evento_id', eventoSeleccionadoId);
                                await clienteSupabase.from('eventos').delete().eq('id', eventoSeleccionadoId);
                                cerrarModalRSVP();
                                calendar.refetchEvents();
                            }
                        };
                    } else {
                        controlesCreador.classList.add('oculto'); 
                    }

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
            ubicacion: ubicacion, 
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
        
        cerrarModalRSVP();
        calendar.refetchEvents(); 
    }

    // --- ACTUALIZADO: Lógica de Límite y Expansión ---
    async function actualizarPanelMejoresDias() {
        const { data, error } = await clienteSupabase.from('disponibilidad').select('*');
        if (error) return;

        const puntuacion = {};
        data.forEach(reg => {
            if (!puntuacion[reg.fecha]) puntuacion[reg.fecha] = 0;
            if (reg.estado === 'disponible') puntuacion[reg.fecha] += 2;
            else if (reg.estado === 'probable') puntuacion[reg.fecha] += 1;
        });

        const diasFiltrados = Object.keys(puntuacion)
            .map(fecha => ({ fecha, puntos: puntuacion[fecha] }))
            .filter(dia => dia.puntos > 0)
            .sort((a, b) => b.puntos - a.puntos);
            
        // Definir límite de 10 o total si se expandió
        const limite = mostrarTodosLosDias ? diasFiltrados.length : 10;
        const diasAMostrar = diasFiltrados.slice(0, limite);
            
        const listaHtml = document.getElementById('listaMejoresDias');
        listaHtml.innerHTML = ''; 
        
        if (diasFiltrados.length === 0) {
            listaHtml.innerHTML = '<li style="text-align:center; color:#6c757d;">Sin datos aún.</li>'; return;
        }

        diasAMostrar.forEach((dia, index) => {
            const li = document.createElement('li');
            li.className = 'dia-top';
            li.innerHTML = `
                <span>#${index + 1} - ${dia.fecha} <span class="puntos-badge">${dia.puntos} pts</span></span> 
                <button class="btn-armar" data-fecha="${dia.fecha}">Crear Evento</button>
            `;
            listaHtml.appendChild(li);
        });

        // Inyectar el botón de Expandir si hay más de 10 resultados
        if (diasFiltrados.length > 10) {
            const liBtn = document.createElement('li');
            liBtn.style.textAlign = 'center';
            liBtn.style.marginTop = '10px';
            liBtn.innerHTML = `<button class="btn blanco-borde" style="width: 100%; padding: 8px;">${mostrarTodosLosDias ? 'Menos fechas' : 'Ver más fechas (' + diasFiltrados.length + ')'}</button>`;
            listaHtml.appendChild(liBtn);

            liBtn.querySelector('button').addEventListener('click', () => {
                mostrarTodosLosDias = !mostrarTodosLosDias;
                actualizarPanelMejoresDias(); 
            });
        }

        document.querySelectorAll('.btn-armar').forEach(btn => {
            btn.addEventListener('click', (e) => {
                fechaSeleccionada = e.target.getAttribute('data-fecha');
                document.getElementById('textoFechaEvento').innerText = `Para el día: ${fechaSeleccionada}`;
                document.getElementById('modalCrearEvento').className = 'modal-visible';
            });
        });
    }

    function iniciarSincronizacionEnVivo() {
        clienteSupabase
            .channel('cambios-publicos')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'disponibilidad' }, (payload) => {
                if (calendar) calendar.refetchEvents();
                actualizarPanelMejoresDias();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'eventos' }, (payload) => {
                if (calendar) calendar.refetchEvents();
            })
            .subscribe();
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