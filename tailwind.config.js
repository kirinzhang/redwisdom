/** 站点统一的 Tailwind 配置。修改页面类名后运行 `npm run build:css` 重新生成 assets/tailwind.css。 */
module.exports = {
    content: ['./*.html', './js/**/*.js', './script.js'],
    theme: {
        extend: {
            colors: {
                'warm-rice': '#F7F4ED',
                'china-red': '#BC2D22',
                'ink-black': '#2B2B2B',
                'dark-beige': '#D6C6B0',
                'sidebar-bg': '#1a1a1a',
                'sidebar-hover': '#2d2d2d',
            },
            fontFamily: {
                mao: ['"Ma Shan Zheng"', 'cursive'],
                serif: ['"Noto Serif SC"', 'serif'],
                cinzel: ['"Cinzel"', 'serif'],
                gotham: ['"Gotham"', '"Montserrat"', 'sans-serif'],
            },
        },
    },
    plugins: [],
};
