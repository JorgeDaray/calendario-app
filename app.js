// Tus credenciales de Supabase
const supabaseUrl = 'https://gunnbobibgwztjaeaafi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1bm5ib2JpYmd3enRqYWVhYWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxODM5NTIsImV4cCI6MjEwMDc1OTk1Mn0.gSqChQVOShjT8oLILid_2VQreKjRvsc-cDbzGGzMQkY';

// SOLUCIÓN: Cambiamos el nombre de la variable a "clienteSupabase"
const clienteSupabase = supabase.createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', function() {
    var calendarEl = document.getElementById('calendar');
    
    var calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        
        // --- FUNCIÓN PARA CARGAR DATOS AL INICIAR ---
        events: async function(info, successCallback, failureCallback) {
            // Usamos clienteSupabase en lugar de supabase
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

            successCallback(eventosVisuales);
        },

        // --- FUNCIÓN DE CLIC ---
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

            // Usamos clienteSupabase en lugar de supabase
            const { data, error } = await clienteSupabase
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
                calendar.refetchEvents();
            }
        }
    });
    
    calendar.render();
});