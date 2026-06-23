module.exports = {
  plugins: [
    [
      require.resolve('@heal-dev/heal-playwright-tracer/code-hook-injector'),
      { include: [/\/e2e\//] },
    ],
  ],
}
