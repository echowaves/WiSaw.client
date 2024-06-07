import TerserPlugin from "terser-webpack-plugin"

export const optimization = {
    minimize: true,
    minimizer: [new TerserPlugin()],
}