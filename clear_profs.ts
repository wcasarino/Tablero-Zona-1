import { fetchProfesionales, clearAllProfesionales } from './src/firebase';

async function run() {
  console.log('Fetching profesionales...');
  const profs = await fetchProfesionales();
  if (!profs || profs.length === 0) {
    console.log('No profesionales found.');
    return;
  }
  const ids = profs.map(p => p.id);
  console.log(`Found ${ids.length} profesionales to delete. Deleting...`);
  await clearAllProfesionales(ids);
  console.log('All profesionales deleted successfully.');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
