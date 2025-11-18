import {xpschema, createOrRetrieveRegistryEntry, table, text, varchar, timestamp, generateUUID} from '../../index';


// Step 1: Define custom column builders
const uuid = (name: string) => varchar(name, {length: 16}).default(generateUUID);


// Step 2: Define Schema
const usersTable = table('users', {
    id: uuid('id').primaryKey(),
    name: text('name'),
    birthday: timestamp('birthday').notNull(),
    gender: varchar('gender', {enum: ['male', 'female'] as const}),
    bio: text('bio'),
    headline: varchar('headline', {length: 20})
});

type UserInsert = typeof usersTable.$inferInsert;
type UserSelect = typeof usersTable.$inferSelect;
// type UserGenderInsert = typeof usersTable.gender.$inferInsert;
// type UserGenderSelect = typeof usersTable.gender.$inferSelect;

const postsTable = table('posts', {
    author: text('name').notNull().references(() => usersTable.name),
    postedAt: timestamp('posted_at').defaultNow(),
    content: varchar('content', {length: 2000}),
})

// Step 3: Define Schema
export const schema = xpschema({
    users: usersTable,
    posts: postsTable
});
// // Step 4: Define the params to connect to a database
// const connInfo = await createOrRetrieveRegistryEntry({
//     name: 'my-db',
//     driverName: 'pglite',
//     dialectName: 'pg'
// });
//
// // Step 5: get a connection, this will auto-bind the tables to the correct dialect
// const db = schema.connect(connInfo);


// Step 6: use it!
// db.users.insert