import React, { useState, useEffect } from 'react';
import { Modal, Box } from '@mui/material';
import EditLoadTable from '../../../components/loads/EditLoadTable';
import EditLoadForm from '../../../components/loads/EditLoadForm';

const EditLoadPage = () => {
  const [editingLoad, setEditingLoad] = useState(null);
  const [refreshTable, setRefreshTable] = useState(false);

  const handleRefreshTable = () => {
    setRefreshTable(!refreshTable);
  };

  return (
    <div>
      <h1>Edit Load</h1>
      <EditLoadTable setEditingLoad={setEditingLoad} refreshTable={refreshTable} />
      <Modal
        open={!!editingLoad}
        onClose={() => setEditingLoad(null)}
        aria-labelledby="edit-load-modal-title"
        aria-describedby="edit-load-modal-description"
      >
        <Box sx={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)', 
          width: 400, 
          bgcolor: 'background.paper', 
          boxShadow: 24, 
          p: 4 
        }}>
          {editingLoad && (
            <EditLoadForm
              editingLoad={editingLoad}
              setEditingLoad={setEditingLoad}
              handleRefreshTable={handleRefreshTable}
            />
          )}
        </Box>
      </Modal>
    </div>
  );
};

export default EditLoadPage;
