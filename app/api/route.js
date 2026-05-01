import { createClient } from "@supabase/supabase-js";

export async function GET(req) {
    try {
        const authHeader = req.headers.get("authorization");

        if (process.env.CRON_SECRET) {
            const expected = `Bearer ${process.env.CRON_SECRET}`;

            if (authHeader !== expected) {
                return Response.json(
                    { error: "No autorizado" },
                    { status: 401 }
                );
            }
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const ahora = new Date().toISOString();

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
            console.error(error);
            return Response.json(
                { error: "Error liberando vencidos", detalle: error.message },
                { status: 500 }
            );
        }

        return Response.json({
            ok: true,
            liberados: data?.length || 0,
            turnos: data || [],
        });
    } catch (error) {
        console.error(error);

        return Response.json(
            { error: "Error inesperado", detalle: error.message },
            { status: 500 }
        );
    }
}