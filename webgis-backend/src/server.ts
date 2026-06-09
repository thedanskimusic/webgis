import app from './app';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`WebGIS API running on port ${PORT}`);
});
