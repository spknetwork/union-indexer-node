export const Resolvers = {
    hello() {
        return "World"
    },
    blog(args: any) {
        console.log(args)
    }
}