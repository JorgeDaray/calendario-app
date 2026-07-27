// Pega aquí las credenciales que copiaste de Supabase
const supabaseUrl = 'https://gunnbobibgwztjaeaafi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1bm5ib2JpYmd3enRqYWVhYWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxODM5NTIsImV4cCI6MjEwMDc1OTk1Mn0.gSqChQVOShjT8oLILid_2VQreKjRvsc-cDbzGGzMQkY';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Inicializar el calendario
document.addEventListener('DOMContentLoaded', function() {
    var calendarEl = document.getElementById('calendar');
    
    var calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        
        // Esta es la función que se ejecuta al hacer clic en un día
        dateClick: async function(info) {
            // 1. Preguntamos el estado (luego lo cambiaremos por un modal HTML más bonito)
            let opcion = prompt(
                "¿Qué estado quieres para el " + info.dateStr + "?\n" +
                "1 = Disponible (Verde)\n" +
                "2 = Probable (Amarillo)\n" +
                "3 = Limpiar día"
            );

            let estado = null;
            let colorEvento = '';
            let titulo = '';

            if (opcion === '1') {
                estado = 'disponible';
                colorEvento = '#28a745'; // Verde
                titulo = 'Disponible';
            } else if (opcion === '2') {
                estado = 'probable';
                colorEvento = '#ffc107'; // Amarillo
                titulo = 'Probable';
            } else if (opcion === '3') {
                estado = 'no_definido';
            } else {
                return; // Si cancela o pone otra cosa, no hacemos nada
            }

            // 2. PEGA AQUÍ TU UUID DE PRUEBA
            const miUsuarioId = 'PEGA_TU_UUID_AQUI'; 

            // 3. Guardamos en Supabase
            // Usamos upsert para que si ya habías marcado ese día, simplemente lo actualice
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
                // 4. Pintamos el evento en el calendario visualmente
                if (estado === 'no_definido') {
                    alert("Día limpiado en la base de datos.");
                    // Nota: para borrar el color visualmente al instante requiere más lógica,
                    // por ahora con recargar la página se limpiará.
                } else {
                    calendar.addEvent({
                        title: titulo,
                        start: info.dateStr,
                        color: colorEvento,
                        allDay: true
                    });
                }
            }
        }
    });
    
    calendar.render();
});