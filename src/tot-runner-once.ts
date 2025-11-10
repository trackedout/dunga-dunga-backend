import mongoose from 'mongoose';
import totWorker from './trophies/tot-worker';
import config from './config/config';
import logger from './modules/logger/logger';
import { Trophy } from './modules/trophy';

async function runOnce() {
  try {
    await mongoose.connect(config.mongoose.url);
    logger.info('Connected to MongoDB');

    console.log('🏆 Running ToT Worker once...');
    await totWorker.run();
    console.log('✅ ToT Worker completed successfully');

    // Query and display results
    const trophies = await Trophy.find({}).exec();

    console.log('\n🏆 TROPHY RESULTS:');
    console.log('==================');
    trophies.forEach((trophy) => {
      console.log(`\n${trophy.totKey}:`);
      console.log(`  Player: ${trophy.sign.text[0]}`);
      console.log(`  Achievement: ${trophy.sign.text[2]}`);
      console.log(`  Date: ${trophy.sign.text[3]}`);
      console.log(`  Location: (${trophy.sign.x}, ${trophy.sign.y}, ${trophy.sign.z})`);
    });
  } catch (error) {
    logger.error('❌ Error running ToT worker:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runOnce();
