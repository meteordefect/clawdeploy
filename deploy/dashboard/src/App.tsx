import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Overview } from './views/Overview';
import { Agents } from './views/Agents';
import { Missions } from './views/Missions';
import { Files } from './views/Files';
import { Sessions } from './views/Sessions';
import { Events } from './views/Events';
import { Settings } from './views/Settings';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/missions" element={<Missions />} />
          <Route path="/files" element={<Files />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/events" element={<Events />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
