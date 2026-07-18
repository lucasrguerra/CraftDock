export function requireAuth(req, res, next) {
  if (req.session && req.session.authed === true) return next();
  return res.status(401).json({ error: 'unauthorized' });
}

export function socketAuth(sessionMiddleware) {
  return (socket, next) => {
    sessionMiddleware(socket.request, {}, () => {
      if (socket.request.session && socket.request.session.authed === true) {
        return next();
      }
      next(new Error('unauthorized'));
    });
  };
}
