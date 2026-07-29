const supabaseUrl = 'https://gunnbobibgwztjaeaafi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1bm5ib2JpYmd3enRqYWVhYWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxODM5NTIsImV4cCI6MjEwMDc1OTk1Mn0.gSqChQVOShjT8oLILid_2VQreKjRvsc-cDbzGGzMQkY';
const clienteSupabase = supabase.createClient(supabaseUrl, supabaseKey);

let usuarioActualId = null;
let calendar; 
let fechaSeleccionada = null; 
let eventoSeleccionadoId = null; 
let mostrarTodosLosDias = false; 
let modoEdicion = false; 
let ultimaVistaActiva = 'dayGridMonth'; 
let pronosticoClima = {};

document.addEventListener('DOMContentLoaded', async function() {
    const loginContainer = document.getElementById('login-container');
    const appContainer = document.getElementById('app-container');
    const btnLogin = document.getElementById('btnLogin');
    const btnLogout = document.getElementById('btnLogout');
    const loginError = document.getElementById('loginError');
    const btnToggleTema = document.getElementById('btnToggleTema');

    const temaGuardado = localStorage.getItem('temaOscuro');
    if (temaGuardado === 'true') {
        document.body.classList.add('dark-mode');
        if (btnToggleTema) btnToggleTema.innerText = '☀️';
    }

    if (btnToggleTema) {
        btnToggleTema.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const esOscuro = document.body.classList.contains('dark-mode');
            localStorage.setItem('temaOscuro', esOscuro);
            btnToggleTema.innerText = esOscuro ? '☀️' : '🌙';
        });
    }

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

        await cargarPronostico();
        renderizarCalendario();
        actualizarPanelMejoresDias();
        iniciarSincronizacionEnVivo(); 
    }

    async function cargarPronostico() {
        try {
            const url = 'https://api.open-meteo.com/v1/forecast?latitude=20.64&longitude=-103.31&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=America%2FMexico_City&forecast_days=14';
            const res = await fetch(url);
            const data = await res.json();
            
            data.daily.time.forEach((fecha, index) => {
                pronosticoClima[fecha] = {
                    max: Math.round(data.daily.temperature_2m_max[index]),
                    min: Math.round(data.daily.temperature_2m_min[index]),
                    codigo: data.daily.weathercode[index],
                    lluvia: data.daily.precipitation_probability_max[index] || 0
                };
            });
        } catch (e) {
            console.error("No se pudo cargar el clima", e);
        }
    }

    function obtenerIconoClima(codigo) {
        if (codigo === 0) return '☀️';
        if (codigo >= 1 && codigo <= 3) return '⛅';
        if (codigo >= 45 && codigo <= 48) return '🌫️';
        if ((codigo >= 51 && codigo <= 67) || (codigo >= 80 && codigo <= 82)) return '🌧️';
        if (codigo >= 71 && codigo <= 77) return '❄️';
        if (codigo >= 95) return '⛈️';
        return '🌤️';
    }

    function obtenerTextoClima(codigo) {
        if (codigo === 0) return 'Soleado';
        if (codigo >= 1 && codigo <= 3) return 'Parcial. Nublado';
        if (codigo >= 45 && codigo <= 48) return 'Niebla';
        if (codigo >= 51 && codigo <= 57) return 'Llovizna';
        if (codigo >= 61 && codigo <= 67) return 'Lluvia';
        if (codigo >= 71 && codigo <= 77) return 'Nieve';
        if (codigo >= 80 && codigo <= 82) return 'Chubascos';
        if (codigo >= 95) return 'Tormenta';
        return 'Variable';
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
            buttonText: { today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día', year: 'Año', list: 'Agenda' },
            initialView: 'dayGridMonth',
            dayMaxEvents: 10, 
            headerToolbar: { left: 'prev,next today', center: 'title', right: 'listYear,multiMonthYear,dayGridMonth,dayGridWeek' },
            
            datesSet: function(info) {
                if (ultimaVistaActiva !== info.view.type) {
                    ultimaVistaActiva = info.view.type;
                    calendar.refetchEvents(); 
                }
            },

            dayCellDidMount: function(arg) {
                const d = arg.date;
                const yy = d.getFullYear();
                const mm = String(d.getMonth()+1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                const fechaStr = `${yy}-${mm}-${dd}`;

                const hoy = new Date();
                hoy.setHours(0,0,0,0);
                const dateCell = new Date(fechaStr + 'T00:00:00');
                const diffDays = Math.round((dateCell - hoy) / (1000 * 60 * 60 * 24));

                if (diffDays >= 0 && diffDays <= 7 && pronosticoClima[fechaStr]) {
                    const clima = pronosticoClima[fechaStr];
                    const icono = obtenerIconoClima(clima.codigo);

                    const climaDiv = document.createElement('div');
                    climaDiv.className = 'clima-celda';
                    climaDiv.title = `Temp: ${clima.min}°C - ${clima.max}°C\nLluvia: ${clima.lluvia}%`;
                    climaDiv.innerHTML = `${icono} ${clima.max}°C`;

                    const dayTop = arg.el.querySelector('.fc-daygrid-day-top');
                    if (dayTop) {
                        dayTop.style.justifyContent = 'space-between';
                        dayTop.prepend(climaDiv);
                    }
                }
            },

            events: async function(fetchInfo, successCallback, failureCallback) {
                try {
                    const verDisp = document.getElementById('chkVerDisponibles').checked;
                    const verEventos = document.getElementById('chkVerEventos').checked;
                    const eventosVisuales = [];
                    const esVistaLista = ultimaVistaActiva.includes('list');

                    const hoyObj = new Date();
                    const yy = hoyObj.getFullYear();
                    const mm = String(hoyObj.getMonth()+1).padStart(2, '0');
                    const dd = String(hoyObj.getDate()).padStart(2, '0');
                    const hoyStr = `${yy}-${mm}-${dd}`;

                    if (verDisp) {
                        // ACTUALIZADO: Pide la tabla disponibilidad Y el nombre del perfil
                        const { data: dataDisp, error: errDisp } = await clienteSupabase.from('disponibilidad').select('*, perfiles(nombre)');
                        if (errDisp) throw errDisp;
                        
                        // Agrupar por fecha para no encimar los fondos de color
                        const dispPorFecha = {};
                        dataDisp.forEach(reg => {
                            if (reg.fecha < hoyStr) return; // IGNORAR PASADO

                            if (!dispPorFecha[reg.fecha]) dispPorFecha[reg.fecha] = { estadoDom: 'probable', usuarios: [] };
                            
                            if (reg.estado === 'disponible') dispPorFecha[reg.fecha].estadoDom = 'disponible';
                            
                            const nombre = reg.perfiles ? reg.perfiles.nombre : 'Alguien';
                            dispPorFecha[reg.fecha].usuarios.push({ nombre, estado: reg.estado });
                        });

                        Object.keys(dispPorFecha).forEach(fecha => {
                            const info = dispPorFecha[fecha];
                            
                            // 1. Dibujar el fondo para dar color al cuadro completo (solo en cuadrícula)
                            if (!esVistaLista) {
                                eventosVisuales.push({ 
                                    start: fecha, 
                                    color: info.estadoDom === 'disponible' ? '#28a745' : '#ffc107', 
                                    allDay: true, 
                                    display: 'background' 
                                });
                            }

                            // 2. Dibujar los nombres como elementos de lista 
                            info.usuarios.forEach(user => {
                                const icono = user.estado === 'disponible' ? '✅' : '🟡';
                                eventosVisuales.push({ 
                                    title: `${icono} ${user.nombre}`, 
                                    start: fecha, 
                                    display: esVistaLista ? 'auto' : 'list-item', 
                                    color: user.estado === 'disponible' ? '#28a745' : '#ffc107'
                                });
                            });
                        });
                    }

                    if (verEventos) {
                        // ACTUALIZADO: Pide eventos Y sus asistencias confirmadas
                        const { data: dataEvt, error: errEvt } = await clienteSupabase.from('eventos').select('*, asistencia_eventos(estado, perfiles(nombre))');
                        if (errEvt) throw errEvt;

                        const iconosCategorias = {
                            'general': '🎉', 'futbol': '⚽', 'videojuegos': '🎮', 'comida': '🍔', 'cine': '🍿', 'fiesta': '🍻'
                        };

                        dataEvt.forEach(evt => {
                            const evtFecha = evt.fecha_hora.split('T')[0];
                            if (evtFecha < hoyStr) return; // IGNORAR PASADO

                            const icono = iconosCategorias[evt.categoria] || '🎉';
                            
                            // Recuperar lista de confirmados (los que dijeron "asistire")
                            let textoConfirmados = '';
                            if (evt.asistencia_eventos) {
                                const confirmados = evt.asistencia_eventos
                                    .filter(a => a.estado === 'asistire' && a.perfiles)
                                    .map(a => a.perfiles.nombre);
                                
                                if (confirmados.length > 0) {
                                    textoConfirmados = ` [✅ ${confirmados.join(', ')}]`;
                                }
                            }

                            eventosVisuales.push({
                                id: evt.id,
                                title: `${icono} ${evt.titulo}${textoConfirmados}`, 
                                start: evt.fecha_hora,
                                color: '#6f42c1', 
                                extendedProps: { 
                                    esOficial: true, 
                                    tituloOriginal: evt.titulo, 
                                    descripcion: evt.descripcion, 
                                    ubicacion: evt.ubicacion, 
                                    categoria: evt.categoria || 'general',
                                    creado_por: evt.creado_por 
                                }
                            });
                        });
                    }
                    successCallback(eventosVisuales);
                } catch (error) { failureCallback(error); }
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

                    const d = evt.start;
                    const yy = d.getFullYear();
                    const mm = String(d.getMonth()+1).padStart(2, '0');
                    const dd = String(d.getDate()).padStart(2, '0');
                    const fechaEventoFormat = `${yy}-${mm}-${dd}`;
                    
                    const rsvpClimaContainer = document.getElementById('rsvpClimaContainer');
                    if (pronosticoClima[fechaEventoFormat]) {
                        const clima = pronosticoClima[fechaEventoFormat];
                        const icono = obtenerIconoClima(clima.codigo);
                        const texto = obtenerTextoClima(clima.codigo);
                        rsvpClimaContainer.innerText = `${icono} ${texto} | Temp: ${clima.min}°C - ${clima.max}°C | 🌧️ Prob. de Lluvia: ${clima.lluvia}%`;
                        rsvpClimaContainer.classList.remove('oculto');
                    } else {
                        rsvpClimaContainer.classList.add('oculto');
                    }

                    const formatLocal = (dateObj) => {
                        const pad = (n) => n < 10 ? '0'+n : n;
                        return `${dateObj.getFullYear()}${pad(dateObj.getMonth()+1)}${pad(dateObj.getDate())}T${pad(dateObj.getHours())}${pad(dateObj.getMinutes())}00`;
                    };
                    const fechaInicio = evt.start;
                    const fechaFin = new Date(fechaInicio.getTime() + 2 * 60 * 60 * 1000); 
                    const tituloGcal = evt.extendedProps.tituloOriginal; 
                    
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
                    const btnEditar = document.getElementById('btnEditarEvento');

                    if (evt.extendedProps.creado_por === usuarioActualId) {
                        controlesCreador.classList.remove('oculto');
                        
                        btnEliminar.onclick = async () => {
                            if (otrosAsistentesConfirmados > 0) {
                                alert("⚠️ No puedes eliminar el evento porque ya hay personas confirmadas. Si no puedes asistir, cambia tu estado a 'No Asistiré'.");
                                return;
                            }
                            
                            if (confirm("¿Estás seguro de que quieres cancelar y borrar este evento?")) {
                                await clienteSupabase.from('asistencia_eventos').delete().eq('evento_id', eventoSeleccionadoId);
                                await clienteSupabase.from('eventos').delete().eq('id', eventoSeleccionadoId);
                                cerrarModalRSVP();
                                calendar.refetchEvents();
                            }
                        };

                        btnEditar.onclick = () => {
                            modoEdicion = true;
                            document.getElementById('tituloModalEvento').innerText = '✏️ Editar Reunión Oficial';
                            document.getElementById('btnGuardarEvento').innerText = 'Actualizar Evento';
                            
                            fechaSeleccionada = fechaEventoFormat;
                            
                            const horas = String(d.getHours()).padStart(2, '0');
                            const mins = String(d.getMinutes()).padStart(2, '0');
                            
                            let climaInfo = '';
                            if(pronosticoClima[fechaSeleccionada]) {
                                const clima = pronosticoClima[fechaSeleccionada];
                                const textoClima = obtenerTextoClima(clima.codigo);
                                climaInfo = ` | Clima: ${obtenerIconoClima(clima.codigo)} ${textoClima} ${clima.max}°C`;
                            }

                            document.getElementById('textoFechaEvento').innerText = `Para el día: ${fechaSeleccionada}${climaInfo}`;
                            document.getElementById('inputTituloEvento').value = evt.extendedProps.tituloOriginal; 
                            document.getElementById('selectCategoriaEvento').value = evt.extendedProps.categoria; 
                            document.getElementById('inputHoraEvento').value = `${horas}:${mins}`;
                            document.getElementById('inputUbicacionEvento').value = evt.extendedProps.ubicacion || '';
                            document.getElementById('inputDescEvento').value = evt.extendedProps.descripcion || '';
                            
                            cerrarModalRSVP();
                            document.getElementById('modalCrearEvento').className = 'modal-visible';
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
    const cerrarModalCrear = () => {
        document.getElementById('modalCrearEvento').className = 'modal-oculto';
        modoEdicion = false; 
    };
    const cerrarModalRSVP = () => document.getElementById('modalRSVP').className = 'modal-oculto';

    async function guardarEstado(estado) {
        if (!fechaSeleccionada || !usuarioActualId) return;
        const { error } = await clienteSupabase.from('disponibilidad').upsert(
            { fecha: fechaSeleccionada, usuario_id: usuarioActualId, estado: estado }, 
            { onConflict: 'fecha,usuario_id' }
        );
        if (!error) { 
            calendar.refetchEvents(); 
            actualizarPanelMejoresDias(); 
        }
        cerrarModalDisp(); 
    }

    async function guardarEvento() {
        const titulo = document.getElementById('inputTituloEvento').value;
        const categoria = document.getElementById('selectCategoriaEvento').value; 
        const hora = document.getElementById('inputHoraEvento').value;
        const ubicacion = document.getElementById('inputUbicacionEvento').value;
        const desc = document.getElementById('inputDescEvento').value;

        if(!titulo || !hora) return alert("Falta título u hora");
        const fechaHoraTimestamp = `${fechaSeleccionada}T${hora}:00`;

        const payloadDB = {
            titulo: titulo,
            descripcion: desc,
            ubicacion: ubicacion, 
            categoria: categoria, 
            fecha_hora: fechaHoraTimestamp
        };

        if (modoEdicion) {
            const { error } = await clienteSupabase.from('eventos').update(payloadDB).eq('id', eventoSeleccionadoId);
            if (error) alert("Error actualizando evento.");
            else calendar.refetchEvents();
        } else {
            payloadDB.creado_por = usuarioActualId;
            const { error } = await clienteSupabase.from('eventos').insert(payloadDB);
            if (error) alert("Error creando evento.");
            else calendar.refetchEvents();
        }
        
        cerrarModalCrear();
    }

    async function guardarRSVP(estado) {
        if(!eventoSeleccionadoId || !usuarioActualId) return;
        
        const { error } = await clienteSupabase.from('asistencia_eventos').upsert(
            { evento_id: eventoSeleccionadoId, usuario_id: usuarioActualId, estado: estado },
            { onConflict: 'evento_id,usuario_id' }
        );

        if(error) alert("Error guardando tu asistencia.");
        else calendar.refetchEvents(); 
        
        cerrarModalRSVP();
    }

    // --- ACTUALIZADO: Panel de Mejores Días ahora muestra los NOMBRES ---
    async function actualizarPanelMejoresDias() {
        const { data, error } = await clienteSupabase.from('disponibilidad').select('*, perfiles(nombre)');
        if (error) return;

        const puntuacion = {};
        data.forEach(reg => {
            if (!puntuacion[reg.fecha]) puntuacion[reg.fecha] = { puntos: 0, nombres: [] };
            
            const nombre = reg.perfiles ? reg.perfiles.nombre : 'Alguien';

            if (reg.estado === 'disponible') {
                puntuacion[reg.fecha].puntos += 2;
                puntuacion[reg.fecha].nombres.push(`✅ ${nombre}`);
            } else if (reg.estado === 'probable') {
                puntuacion[reg.fecha].puntos += 1;
                puntuacion[reg.fecha].nombres.push(`🟡 ${nombre}`);
            }
        });

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const diasFiltrados = Object.keys(puntuacion)
            .map(fecha => ({ fecha, puntos: puntuacion[fecha].puntos, nombres: puntuacion[fecha].nombres }))
            .filter(dia => {
                const d = new Date(dia.fecha + 'T00:00:00');
                return dia.puntos > 0 && d >= hoy; 
            })
            .sort((a, b) => {
                if (b.puntos !== a.puntos) {
                    return b.puntos - a.puntos; 
                }
                const diffA = Math.abs(new Date(a.fecha + 'T00:00:00') - hoy);
                const diffB = Math.abs(new Date(b.fecha + 'T00:00:00') - hoy);
                return diffA - diffB;
            });
            
        const limite = mostrarTodosLosDias ? diasFiltrados.length : 10;
        const diasAMostrar = diasFiltrados.slice(0, limite);
            
        const listaHtml = document.getElementById('listaMejoresDias');
        listaHtml.innerHTML = ''; 
        
        if (diasFiltrados.length === 0) {
            listaHtml.innerHTML = '<li style="text-align:center; color:#6c757d;">Sin datos aún.</li>'; return;
        }

        diasAMostrar.forEach((dia, index) => {
            let infoClima = '';
            if(pronosticoClima[dia.fecha]) {
                const clima = pronosticoClima[dia.fecha];
                const icono = obtenerIconoClima(clima.codigo);
                const textoClima = obtenerTextoClima(clima.codigo); 
                infoClima = `<span class="clima-badge" title="Mín: ${clima.min}°C | 🌧️ Lluvia: ${clima.lluvia}%">${icono} ${textoClima} ${clima.max}°C</span>`;
            }

            const d = new Date(dia.fecha + 'T00:00:00');
            const diffDays = Math.round((d - hoy) / (1000 * 60 * 60 * 24));
            
            let colorBorde = '';
            let textoUrgencia = '';
            if (diffDays <= 3) {
                colorBorde = '#dc3545'; 
                textoUrgencia = '<span style="color:#dc3545; font-size:12px; font-weight:bold;">(¡Urge!)</span>';
            } else if (diffDays <= 7) {
                colorBorde = '#ffc107'; 
                textoUrgencia = '<span style="color:#e0a800; font-size:12px; font-weight:bold;">(Próximo)</span>';
            } else {
                colorBorde = '#28a745'; 
            }

            const li = document.createElement('li');
            li.className = 'dia-top';
            li.style.borderLeft = `5px solid ${colorBorde}`; 

            // INYECCIÓN DE LA LISTA DE NOMBRES DEBAJO DEL PUNTAJE
            li.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:2px; flex:1;">
                    <span>#${index + 1} - ${dia.fecha} ${textoUrgencia} <span class="puntos-badge">${dia.puntos} pts</span> ${infoClima}</span> 
                    <span class="nombres-lista">${dia.nombres.join(', ')}</span>
                </div>
                <button class="btn-armar" data-fecha="${dia.fecha}">Crear Evento</button>
            `;
            listaHtml.appendChild(li);
        });

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
                modoEdicion = false;
                document.getElementById('tituloModalEvento').innerText = '🎉 Crear Reunión Oficial';
                document.getElementById('btnGuardarEvento').innerText = 'Guardar Evento';
                
                document.getElementById('inputTituloEvento').value = '';
                document.getElementById('selectCategoriaEvento').value = 'general'; 
                document.getElementById('inputHoraEvento').value = '';
                document.getElementById('inputUbicacionEvento').value = '';
                document.getElementById('inputDescEvento').value = '';

                fechaSeleccionada = e.target.getAttribute('data-fecha');
                
                let climaInfo = '';
                if(pronosticoClima[fechaSeleccionada]) {
                    const clima = pronosticoClima[fechaSeleccionada];
                    const textoClima = obtenerTextoClima(clima.codigo);
                    climaInfo = ` | Clima: ${obtenerIconoClima(clima.codigo)} ${textoClima} ${clima.max}°C`;
                }

                document.getElementById('textoFechaEvento').innerText = `Para el día: ${fechaSeleccionada}${climaInfo}`;
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