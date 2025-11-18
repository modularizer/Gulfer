# XP (cross-platform) Schema Builder
Building off of drizzle-ORM and zod, make a versatile way to define your schema ONCE and use for many dialects and implementations.


# Step 1 - Import generic column builders which work for any language
Yes, SQLite has only text columns, but why not do common conversions for you?
`jsonb = (name: string) => text(name, {mode: 'json'});`

Step one exposes common column builders. 
Instantiating each column builder does not bind the column to a dialect, implementation, or table yet, it remains abstract until assigned.

# Step 2 (optional) - Build your own custom types by extending the generic column builders
Use hex a lot? Make a column which enforces a hex schema, using zod

# Step 3 - make an abstract table definition from your abstract column definitions


# Step 4 - make an abstract schema from your abstract table definitions

# Step 5 - bind to a dialect
# Step 6 - bind to an implementation
# Step 7 - bind to a connection
