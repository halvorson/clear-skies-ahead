import { onRequest } from 'firebase-functions/v2/https';

export const getWeather = onRequest((_req, res) => {
  res.status(501).json({
    message: 'Not implemented in MVP — call NWS directly from the client.',
  });
});
