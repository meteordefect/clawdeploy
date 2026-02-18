import {BrowserRouter, Routes, Route, Navigate} from 'react-router-dom';
import {Layout} from './components/Layout';
import {DeployBanner} from './components/DeployBanner';
import {ChatView} from './components/chat/ChatView';
import {Overview} from './views/Overview';
import {Missions} from './views/Missions';
import {Files} from './views/Files';
import {Sessions} from './views/Sessions';
import {Events} from './views/Events';
import {Settings} from './views/Settings';

function App() {
    return (
        <BrowserRouter basename={(import.meta.env.VITE_BASE_PATH || '/').replace(/\/$/, '') || '/'}>
            <DeployBanner/>
            <Layout>
                <Routes>
                    <Route path="/" element={<Navigate to="/overview" replace/>}/>
                    <Route path="/chat" element={<ChatView/>}/>
                    <Route path="/overview" element={<Overview/>}/>
                    <Route path="/missions" element={<Missions/>}/>
                    <Route path="/files" element={<Files/>}/>
                    <Route path="/sessions" element={<Sessions/>}/>
                    <Route path="/events" element={<Events/>}/>
                    <Route path="/settings" element={<Settings/>}/>
                </Routes>
            </Layout>
        </BrowserRouter>
    );
}

export default App;
