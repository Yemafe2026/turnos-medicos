import ReprogramarClient from "./ReprogramarClient";

export default async function Page({ params }) {
    const { token } = await params;

    return <ReprogramarClient token={token} />;
}