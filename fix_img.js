const fs = require('fs');
const file = 'src/screens/SnapMapScreen.tsx';
let data = fs.readFileSync(file, 'utf-8');

data = data.replace('setFriends(merged.slice(0, 8)); // 最多展示8个好友\n    getFriendsLocations().then(locations => { if(locations.length) setFriendLocations(locations); }).catch(() => {});', 
setFriends(merged.slice(0, 8)); // 最多展示8个好友
      })
      .finally(() => {
          setLoading(false);
      });

    getFriendsLocations()
      .then(locations => { if (locations.length) setFriendLocations(locations); })
      .catch(() => {});\);

data = data.replace('{selectedItem.description}', 
\<div style={{ width: '100%', height: '120px', borderRadius: '8px', overflow: 'hidden', marginBottom: '8px' }}>
                      <img src={IMAGES.STUDY_ROOM_DARK} alt="Place Image" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    {selectedItem.description}\);

fs.writeFileSync(file, data);