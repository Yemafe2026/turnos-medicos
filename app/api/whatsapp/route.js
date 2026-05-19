export async function POST(req) {
    try {
        const body = await req.json();

        const telefono = String(body.telefono || "").replace(/\D/g, "");
        const mensaje = String(body.mensaje || "").trim();

        if (!telefono) {
            return Response.json(
                { error: "Falta el número de teléfono." },
                { status: 400 }
            );
        }

        if (!mensaje) {
            return Response.json(
                { error: "Falta el mensaje." },
                { status: 400 }
            );
        }

        const token = process.env.WHATSAPP_TOKEN;
        const phoneNumberId = process.env.WHATSAPP_PHONE_ID;

        if (!token) {
            return Response.json(
                { error: "Falta WHATSAPP_TOKEN en Vercel." },
                { status: 500 }
            );
        }

        if (!phoneNumberId) {
            return Response.json(
                { error: "Falta WHATSAPP_PHONE_ID en Vercel." },
                { status: 500 }
            );
        }

        const url = `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`;

        const payload = {
            messaging_product: "whatsapp",
            to: telefono,
            type: "text",
            text: {
                preview_url: false,
                body: mensaje,
            },
        };

        const metaResponse = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const metaData = await metaResponse.json();

        if (!metaResponse.ok) {
            return Response.json(
                {
                    error: "Meta rechazó el envío de WhatsApp.",
                    status: metaResponse.status,
                    detalle: metaData,
                },
                { status: 500 }
            );
        }

        return Response.json({
            ok: true,
            telefono,
            meta: metaData,
        });
    } catch (error) {
        return Response.json(
            {
                error: "Error inesperado enviando WhatsApp.",
                detalle: error.message,
            },
            { status: 500 }
        );
    }
}