import { schema } from 'nexus'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

schema.objectType({
  name: 'User',            // <- Name of your type
  definition(t) {
    t.int('id')            // <- Field named `id` of type `Int`
    t.string('name')      // <- Field named `title` of type `String`
    t.string('userid')       // <- Field named `body` of type `String`
    t.string('createdAt')
    t.string('password')
  },
})

schema.objectType({
  name: 'AuthResult',            // <- Name of your type
  definition(t) {
    t.field('user', {
      type: 'User'
    })
    t.string('token')
  },
})

schema.extendType({
  type: 'Query',            
  definition(t) {
    t.field('users', {    
      nullable: false,      
      type: 'User',         
      list: true,           
      resolve(_, __, ctx) {
          return ctx.db.user.findMany();
        }
    })
  },
});

schema.extendType({
  type: 'Mutation',
  definition(t) {
    t.field('signup', {
      type: 'User',
      args: {                                        
        userid: schema.stringArg({ required: true }),
        name: schema.stringArg({ required: true }),  
        password: schema.stringArg({ required: true }),  
      },
      resolve(_root, args, ctx) {
        return signup(args, ctx);
      },
    })
  },
})

async function signup(args: {                                        
  userid: string,
  name: string,  
  password: string,  
}, context: any) {
  const password = await bcrypt.hash(args.password, 10)
  const user = await context.db.user.create({ data: { ...args, password } })
  // const token = jwt.sign({ userId: user.id }, APP_SECRET)
  return user
}

schema.extendType({
  type: 'Mutation',
  definition(t) {
    t.field('login', {
      type: 'AuthResult',
      args: {                                        
        userid: schema.stringArg({ required: true }),
        password: schema.stringArg({ required: true }),  
      },
      resolve(root, args, ctx) {
        return login(root, args, ctx);
      },
    })
  },
})

async function login(_parent: any, args: {                                        
  userid: string,
  password: string
}, context: any) {
  const user = await context.db.user.findOne({ where: { userid: args.userid } })
  if (!user) {
    throw new Error('No such user found')
  }
  const valid = await bcrypt.compare(args.password, user.password)
  if (!valid) {
    throw new Error('Invalid password')
  }
  const token = jwt.sign({ sub: user.userid }, "APP_SECRET")
  return {
    user,
    token
  }
}

schema.extendType({
  type: 'Query',            
  definition(t) {
    t.field('self', {
      type: 'User',
      args: {                                        
        token: schema.stringArg({ required: true }),  
      },
      resolve(_, args, ctx) {
          const payload = jwt.verify(args.token, "APP_SECRET");
          return ctx.db.user.findOne({where: {userid: payload.sub}});
        }
    })
  },
});
