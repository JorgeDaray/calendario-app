const supabaseUrl = 'https://gunnbobibgwztjaeaafi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1bm5ib2JpYmd3enRqYWVhYWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxODM5NTIsImV4cCI6MjEwMDc1OTk1Mn0.gSqChQVOShjT8oLILid_2VQreKjRvsc-cDbzGGzMQkY';
const clienteSupabase = supabase.createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', function() {
    var calendarEl = document.getElementById('calendar');
    
    // Variable para guardar el día que el usuario seleccionó antes de abrir el modal
    let fechaSeleccionada = null; 
    
    var calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth', // Vista por defecto (Mes)
        
        // --- NUEVO: BOTONES DE VISTAS ---
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,dayGridWeek,dayGridDay' // Agrega vistas: mes, semana, día
        },
        
        events: async function(info, successCallback, failureCallback) {
            const { data, error } = await clienteSupabase
                .from('disponibilidad')
                .select('*');

            if (error) {
                console.error("Error cargando la base de datos:", error);
                failureCallback(error);
                return;
            }

            const eventosVisuales = [];
            data.forEach(registro => {
                if (registro.estado === 'disponible') {
                    eventosVisuales.push({ title: 'Disponible', start: registro.fecha, color: '#28a745', allDay: true });
                } else if (registro.estado === 'probable') {
                    eventosVisuales.push({ title: 'Probable', start: registro.fecha, color: '#ffc107', allDay: true });
                }
            });
            successCallback(eventosVisuales);
        },

        // --- NUEVA LÓGICA: ABRIR EL MODAL ---
        dateClick: function(info) {
            fechaSeleccionada = info.dateStr; // Guardamos la fecha donde hizo clic
            document.getElementById('modalFechaTexto').innerText = "Estado para: " + info.dateStr;
            document.getElementById('modalDisponibilidad').className = 'modal-visible'; // Mostramos el modal
        }
    });
    
    calendar.render();

    // --- FUNCIONES DEL MODAL ---
    
    // Función para cerrar el modal
    function cerrarModal() {
        document.getElementById('modalDisponibilidad').className = 'modal-oculto';
        fechaSeleccionada = null;
    }

    // Función principal para enviar a Supabase
    async function guardarEstado(estado) {
        if (!fechaSeleccionada) return;

        // ¡IMPORTANTE! Reemplaza esto con el UUID de tu usuario en Supabase
        const miUsuarioId = 'f8978a87-36ce-46ae-a14e-c4ece23390c8'; 

        const { data, error } = await clienteSupabase
            .from('disponibilidad')
            .upsert({ 
                fecha: fechaSeleccionada, 
                usuario_id: miUsuarioId, 
                estado: estado 
            }, { 
                onConflict: 'fecha,usuario_id' 
            });

        if (error) {
            console.error("Error en Supabase:", error);
            alert("Hubo un error al guardar. Revisa la consola.");
        } else {
            calendar.refetchEvents(); 
            actualizarPanelMejoresDias(); // <--- AGREGA ESTA LÍNEA
        }
        
        cerrarModal(); // Cerramos la ventana al terminar
    }

    // --- LÓGICA DEL PANEL DE MEJORES DÍAS ---
    async function actualizarPanelMejoresDias() {
        const { data, error } = await clienteSupabase
            .from('disponibilidad')
            .select('*');

        if (error) return console.error("Error cargando mejores días:", error);

        // 1. Agrupar y sumar puntos por fecha
        const puntuacion = {};
        data.forEach(registro => {
            if (!puntuacion[registro.fecha]) puntuacion[registro.fecha] = 0;
            
            if (registro.estado === 'disponible') puntuacion[registro.fecha] += 2;
            else if (registro.estado === 'probable') puntuacion[registro.fecha] += 1;
        });

        // 2. Convertir a arreglo, filtrar los de 0 puntos y ordenar de mayor a menor
        const diasOrdenados = Object.keys(puntuacion)
            .map(fecha => ({ fecha, puntos: puntuacion[fecha] }))
            .filter(dia => dia.puntos > 0)
            .sort((a, b) => b.puntos - a.puntos);

        // 3. Tomar el Top 3
        const top3 = diasOrdenados.slice(0, 3);

        // 4. Renderizar en el HTML
        const listaHtml = document.getElementById('listaMejoresDias');
        listaHtml.innerHTML = ''; 

        if (top3.length === 0) {
            listaHtml.innerHTML = '<li style="text-align:center; color:#6c757d;">Aún no hay días con disponibilidad.</li>';
            return;
        }

        top3.forEach((dia, index) => {
            const li = document.createElement('li');
            li.className = 'dia-top';
            // Opcional: Podrías usar JS para formatear la fecha a 'DD/MM/YYYY' en el futuro
            li.innerHTML = `
                <span>#${index + 1} - Fecha: ${dia.fecha}</span> 
                <span class="puntos-badge">${dia.puntos} pts</span>
            `;
            listaHtml.appendChild(li);
        });
    }

    // Llamamos a la función por primera vez al cargar la página
    actualizarPanelMejoresDias();

    // Conectamos los botones del modal con sus funciones
    document.getElementById('btnDisponible').addEventListener('click', () => guardarEstado('disponible'));
    document.getElementById('btnProbable').addEventListener('click', () => guardarEstado('probable'));
    document.getElementById('btnLimpiar').addEventListener('click', () => guardarEstado('no_definido'));
    document.getElementById('btnCerrar').addEventListener('click', cerrarModal);
});