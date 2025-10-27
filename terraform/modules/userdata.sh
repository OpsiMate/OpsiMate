# #!/bin/bash

# ## changing host name
# IP=$(ip= ip addr show eth0|grep inet|awk -F " " '{print $2}'|awk -F "/" '{print $1}'|head -n 1 | sed 's/\./-/g')
# hostnamectl set-hostname $IP




# ## Calling bootstrap to add the node to the cluster
# set -o xtrace

# echo "Getting instance type"
# ilc=`aws ec2 describe-instances --instance-ids $instance_id --region='${datacenter}' --query 'Reservations[0].Instances[0].InstanceLifecycle' --output text`

# sleep 3

# if [ "$ilc" == "spot" ]; then
#   echo "In Spot Block"
#     if [ "${taint_key}" != "spotInstance" ]; then
#     echo "Starting Spot Instance with taints -- ${taint_key}=${taint_value}"
#     /etc/eks/bootstrap.sh --apiserver-endpoint '${cluster-endpoint}' --b64-cluster-ca '${cluster-certificate-authority}' '${cluster-name}' --kubelet-extra-args '--node-labels=${taint_key}=${taint_value} --register-with-taints=${taint_key}=${taint_value}:NoExecute,${taint_key}=${taint_value}:NoSchedule' --dns-cluster-ip ${localdns-ip}
#     else 
#     /etc/eks/bootstrap.sh --apiserver-endpoint '${cluster-endpoint}' --b64-cluster-ca '${cluster-certificate-authority}' '${cluster-name}' --kubelet-extra-args '--node-labels=instanceType=spotInstance --register-with-taints=${taint_key}=${taint_value}:${tainteffect}' --dns-cluster-ip ${localdns-ip}
#     fi
# else
#   if [ "${taint_key}" != "spotInstance" ]; then
#     echo "Starting on demand with taints -- ${taint_key}=${taint_value}"
#     /etc/eks/bootstrap.sh --apiserver-endpoint '${cluster-endpoint}' --b64-cluster-ca '${cluster-certificate-authority}' '${cluster-name}' --kubelet-extra-args '--node-labels=${taint_key}=${taint_value} --register-with-taints=${taint_key}=${taint_value}:NoExecute,${taint_key}=${taint_value}:NoSchedule' --dns-cluster-ip ${localdns-ip}
#   else
#     echo "Starting on demand without taints"
#     /etc/eks/bootstrap.sh --apiserver-endpoint '${cluster-endpoint}' --b64-cluster-ca '${cluster-certificate-authority}' '${cluster-name}' --kubelet-extra-args '--node-labels=instanceType=onDemand' --dns-cluster-ip ${localdns-ip}
#   fi
# fi
