// https://github.com/camji55/nexus-plugin-jwt-auth
import { PrismaClient } from '@prisma/client';

import { schema } from 'nexus'
const db = new PrismaClient()
schema.addToContext(({ _req, _res }) => ({ db })) // expose Prisma Client to all resolvers