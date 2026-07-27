// Tus credenciales de Supabase
const supabaseUrl = 'https://gunnbobibgwztjaeaafi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1bm5ib2JpYmd3enRqYWVhYWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxODM5NTIsImV4cCI6MjEwMDc1OTk1Mn0.gSqChQVOShjT8oLILid_2VQreKjRvsc-cDbzGGzMQkY';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', function() {
    var calendarEl = document.getElementById('calendar');
    
    var calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        
        // --- NUEVO: FUNCIÓN PARA CARGAR DATOS AL INICIAR ---
        events: async function(info, successCallback, failureCallback) {
            // Hacemos la consulta a Supabase
            const { data, error } = await supabase
                .from('disponibilidad')
                .select('*');

            if (error) {
                console.error("Error cargando la base de datos:", error);
                failureCallback(error);
                return;
            }

            // Transformamos los datos al formato que entiende FullCalendar
            const eventosVisuales = [];
            
            data.forEach(registro => {
                if (registro.estado === 'disponible') {
                    eventosVisuales.push({
                        title: 'Disponible',
                        start: registro.fecha,
                        color: '#28a745',
                        allDay: true
                    });
                } else if (registro.estado === 'probable') {
                    eventosVisuales.push({
                        title: 'Probable',
                        start: registro.fecha,
                        color: '#ffc107',
                        allDay: true
                    });
                }
            });

            // Le entregamos los eventos al calendario para que los dibuje
            successCallback(eventosVisuales);
        },

        // --- TU FUNCIÓN DE CLIC ACTUALIZADA ---
        dateClick: async function(info) {
            let opcion = prompt(
                "¿Qué estado quieres para el " + info.dateStr + "?\n" +
                "1 = Disponible (Verde)\n" +
                "2 = Probable (Amarillo)\n" +
                "3 = Limpiar día"
            );

            let estado = null;

            if (opcion === '1') estado = 'disponible';
            else if (opcion === '2') estado = 'probable';
            else if (opcion === '3') estado = 'no_definido';
            else return; 

            // ¡IMPORTANTE! Reemplaza esto con el UUID de tu usuario en Supabase
            const miUsuarioId = 'f8978a87-36ce-46ae-a14e-c4ece23390c8'; 

            const { data, error } = await supabase
                .from('disponibilidad')
                .upsert({ 
                    fecha: info.dateStr, 
                    usuario_id: miUsuarioId, 
                    estado: estado 
                }, { 
                    onConflict: 'fecha,usuario_id' 
                });

            if (error) {
                console.error("Error en Supabase:", error);
                alert("Hubo un error al guardar. Revisa la consola.");
            } else {
                // Si todo sale bien, le decimos al calendario que recargue los datos
                calendar.refetchEvents();
            }
        }
    });
    
    calendar.render();
});