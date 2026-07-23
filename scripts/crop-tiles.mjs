import sharp from 'sharp'
await sharp('public/tiles/gen5.jpg').extract({ left: 32, top: 64, width: 32, height: 32 }).png().toFile('public/tiles/grass-a.png')
await sharp('public/tiles/gen5.jpg').extract({ left: 128, top: 8, width: 48, height: 48 }).png().toFile('public/tiles/sand-a.png')
await sharp('public/tiles/gen3.jpg').extract({ left: 76, top: 24, width: 32, height: 32 }).png().toFile('public/tiles/water-a.png')
await sharp('public/tiles/gen4.png').extract({ left: 40, top: 136, width: 48, height: 48 }).png().toFile('public/tiles/grass-b.png')
console.log('done')
