import { createClient } from "@supabase/supabase-js";

export async function GET(req) {
    try {
        // 🔐 Validación de seguridad (cron)
        const authHeader = req.headers.get("authorization");

        if (process.env.CRON_SECRET) {
            if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
                return Response.json(
                    { error: "No autorizado" },
                    { status: 401 }
                );
            }
        }

        // 🔗 Conexión a Supabase
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // 🕒 Fecha actual
        const ahora = new Date().toISOString();

        // 🔄 Liberar turnos vencidos
        const { data, error } = await supabase
            .from("turnos")
            .update({
                estado: "No Confirmado",
                vencido_automaticamente: true,
                motivo_no_confirmacion: "Pago no confirmado antes del vencimiento",
            })
            .eq("estado", "Pendiente de pago")
            .eq("pagado", false)
            .lt("vencimiento_pago_at", ahora)
            .select();

        if (error) {
            console.error("Error Supabase:", error);
            return Response.json(
                { error: error.message },
                { status: 500 }
            );
        }

        // ✅ Respuesta OK
        return Response.json({
            ok: true,
            liberados: data?.length || 0,
            timestamp: ahora,
        });

    } catch (e) {
        console.error("Error general:", e);
        return Response.json(
            { error: e.message },
            { status: 500 }
        );
    }
}