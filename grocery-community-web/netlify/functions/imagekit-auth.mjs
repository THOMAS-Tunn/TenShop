import ImageKit from "@imagekit/nodejs";

export const handler = async () => {
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;

  if (!privateKey) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        error: "Missing ImageKit private key.",
        help: "Add IMAGEKIT_PRIVATE_KEY to your Netlify environment to enable uploads.",
      }),
    };
  }

  const client = new ImageKit({ privateKey });
  const authParams = client.helper.getAuthenticationParameters();

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(authParams),
  };
};
