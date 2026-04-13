import "@fastify/jwt";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: any;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      sub: string;
      role: string;
      email: string;
    };
    user: {
      sub: string;
      role: string;
      email: string;
    };
  }
}
